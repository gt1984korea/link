import importlib.util
import io
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import wave
from pathlib import Path

spec = importlib.util.spec_from_file_location('voxcpm_server', Path(__file__).with_name('server.py'))
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)

def wav_fixture():
    output = io.BytesIO()
    with wave.open(output, 'wb') as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(48000)
        stream.writeframes(b'\0\0' * 480)
    return output.getvalue()

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.calls = []
        def synthesize(text, style):
            self.calls.append((text, style))
            return wav_fixture()
        self.service = server_module.SpeechService(synthesize, Path(self.temp.name))
        self.server = server_module.make_server(('127.0.0.1', 0), self.service, 'test-token')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}/synthesize'
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()
    def request(self, data, token='test-token'):
        req = urllib.request.Request(self.url, json.dumps(data).encode(),
            {'Content-Type':'application/json','Authorization':f'Bearer {token}'})
        try:
            return urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            return error
    def test_auth_and_input_validation_do_not_generate(self):
        with self.request({'text':'구절'}, 'bad-token') as response:
            self.assertEqual(response.status, 401)
        for data in [{'text':''}, {'text':'가'*1201}, {'text':'구절', 'style':'arbitrary'}, {'text':123}, []]:
            with self.request(data) as response:
                self.assertEqual(response.status, 400)
        self.assertEqual(self.calls, [])
    def test_audio_and_persistent_cache(self):
        for _ in range(2):
            with self.request({'text':'하나님은 사랑이시라.', 'style':'calm'}) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Content-Type'], 'audio/wav')
                self.assertEqual(response.read(), wav_fixture())
        self.assertEqual(len(self.calls), 1)
        reloaded = server_module.SpeechService(lambda *_: self.fail('cache miss'), Path(self.temp.name))
        self.assertEqual(reloaded.generate('하나님은 사랑이시라.', 'calm'), wav_fixture())
    def test_busy_returns_retryable_error(self):
        self.service.lock.acquire()
        try:
            with self.request({'text':'새 구절'}) as response:
                self.assertEqual(response.status, 429)
        finally:
            self.service.lock.release()
    def test_failure_releases_gpu_and_does_not_cache(self):
        def fail(*_): raise RuntimeError('private model path')
        self.service.synthesize = fail
        with self.assertLogs(level='ERROR'), self.request({'text':'구절'}) as response:
            self.assertEqual(response.status, 500)
            self.assertNotIn(b'private model path', response.read())
        self.service.synthesize = lambda *_: wav_fixture()
        with self.request({'text':'구절'}) as response:
            self.assertEqual(response.status, 200)

if __name__ == '__main__': unittest.main()
