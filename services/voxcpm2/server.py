"""VoxCPM2 GPU worker. 외부에는 HTTPS reverse proxy를 통해 노출합니다."""
import hashlib
import hmac
import io
import json
import logging
import os
from pathlib import Path
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STYLES = {
    'calm': 'A middle-aged Korean man with a deep, low-pitched baritone male voice, calm and clear, reverent and steady, reading Korean scripture at a measured pace',
    'warm': 'An adult Korean man with a warm, gentle, low-pitched male voice, soft and clear, reverent and steady, reading Korean scripture at a measured pace',
    'clear': 'An adult Korean man with a clear, resonant, confident male voice, reverent and steady, reading Korean scripture without shouting',
}
MAX_AUDIO_BYTES = 24 * 1024 * 1024

class BusyError(Exception):
    pass

class SpeechService:
    def __init__(self, synthesize, cache_dir):
        self.synthesize = synthesize
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def generate(self, text, style):
        key = hashlib.sha256(json.dumps(['voxcpm2-v2', text, style], ensure_ascii=False).encode()).hexdigest()
        path = self.cache_dir / f'{key}.wav'
        if path.is_file():
            return path.read_bytes()
        if not self.lock.acquire(blocking=False):
            raise BusyError()
        try:
            if path.is_file():
                return path.read_bytes()
            audio = self.synthesize(text, style)
            if not (44 <= len(audio) <= MAX_AUDIO_BYTES and audio[:4] == b'RIFF' and audio[8:12] == b'WAVE'):
                raise ValueError('Invalid generated audio')
            temporary = path.with_suffix('.tmp')
            temporary.write_bytes(audio)
            temporary.replace(path)
            return audio
        finally:
            self.lock.release()


def make_server(address, service, token):
    if not token:
        raise ValueError('VOXCPM2_TOKEN is required')

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def send_payload(self, status, payload, content_type='application/json'):
            data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
            try:
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                if status == 429:
                    self.send_header('Retry-After', '10')
                self.end_headers()
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                # 프록시의 대기 시간이 지나도 생성 결과는 디스크에 남아 다음 요청에서 재사용됩니다.
                pass

        def do_GET(self):
            if self.path == '/healthz':
                self.send_payload(200, {'ready': True, 'model': 'openbmb/VoxCPM2'})
            else:
                self.send_payload(404, {'error': 'Not found'})

        def do_POST(self):
            if self.path != '/synthesize':
                return self.send_payload(404, {'error': 'Not found'})
            supplied = self.headers.get('Authorization', '')
            if not hmac.compare_digest(supplied.encode(), f'Bearer {token}'.encode()):
                return self.send_payload(401, {'error': 'Unauthorized'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 16384:
                    raise ValueError()
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict):
                    raise ValueError()
                text = data.get('text')
                style = data.get('style', 'calm')
                if not isinstance(text, str) or not text.strip() or len(text) > 1200:
                    raise ValueError()
                if not isinstance(style, str) or style not in STYLES:
                    raise ValueError()
            except (ValueError, UnicodeError, TimeoutError):
                return self.send_payload(400, {'error': 'Invalid text or style'})
            try:
                audio = service.generate(text.strip(), style)
                self.send_payload(200, audio, 'audio/wav')
            except BusyError:
                self.send_payload(429, {'error': 'GPU busy. Retry shortly.'})
            except Exception:
                logging.exception('Speech generation failed')
                self.send_payload(500, {'error': 'Speech generation failed'})

        def log_message(self, *_):
            pass  # 본문과 인증 정보를 요청 로그에 기록하지 않습니다.

    return ThreadingHTTPServer(address, Handler)


def main():
    token = os.environ.get('VOXCPM2_TOKEN', '')
    if not token:
        raise RuntimeError('Set VOXCPM2_TOKEN before starting the worker')
    from voxcpm import VoxCPM
    import soundfile as sf
    model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)

    def synthesize(text, style):
        wav = model.generate(
            text=f'({STYLES[style]}){text}', cfg_value=2.0, inference_timesteps=10,
        )
        output = io.BytesIO()
        sf.write(output, wav, model.tts_model.sample_rate, format='WAV', subtype='PCM_16')
        return output.getvalue()

    service = SpeechService(synthesize, os.environ.get('VOXCPM2_CACHE_DIR', '/cache/audio'))
    server = make_server(('0.0.0.0', int(os.environ.get('PORT', '8080'))), service, token)
    logging.info('VoxCPM2 ready')
    try:
        server.serve_forever()
    finally:
        server.server_close()

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
