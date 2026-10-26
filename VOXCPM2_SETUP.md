> **사용 중지됨:** 자동 낭독은 이제 Google Cloud Text-to-Speech(`functions/tts.js`)로 생성합니다.
> 이 문서와 `services/voxcpm2`는 예전 GPU 워커 방식의 기록이며 현재 함수는 이 워커를 호출하지 않습니다.

# VoxCPM2 자동 낭독

관리자의 구절 편집에서 **자동 낭독**을 선택하면 저장 직후 음성을 생성합니다.
성도는 메인 화면의 **읽어주기**로 듣습니다. 자동 재생 제한이 있는 브라우저에서는
음성이 준비된 뒤 재생 버튼을 한 번 눌러야 합니다.

**업로드한 녹음**을 선택하면 기존 음성 녹음 탭의 파일(최대 5개)을 순서대로 재생합니다.
파일은 기존처럼 모든 구절이 공유합니다. 자동 낭독을 선택한 구절에서는 공유 파일을 사용하지 않습니다.
기존 구절은 업로드 녹음 우선 동작을 유지하며, 새 구절의 기본값은 자동 낭독입니다.
녹음이 없으면 저장된 구절의 자동 낭독을 요청합니다.

## 실제 서비스에 연결하기

코드만 배포해서는 모델이 실행되지 않습니다. 먼저 GPU worker가 필요합니다.
현재 로컬 검증은 테스트 WAV를 사용했으며, 실제 모델 추론·음질·GPU 이미지 실행은 별도로 검증해야 합니다.

- 공식 모델: https://huggingface.co/openbmb/VoxCPM2
- 공식 코드: https://github.com/OpenBMB/VoxCPM
- 공식 안내 기준 한국어 지원, 약 8GB VRAM. 실제 여유 메모리와 생성 시간은 GPU에서 확인합니다.
- worker: Python 3.10~3.12, CUDA 12 이상. Docker에는 PyTorch 2.6/CUDA 12.4 환경을 지정했습니다.

### 1. GPU worker 실행

NVIDIA Container Toolkit이 설치된 GPU 서버에서 `services/voxcpm2` 디렉터리를 사용합니다.
비밀 키는 충분히 긴 난수로 만들고 서버 환경 변수에만 보관합니다. 브라우저 코드에 넣지 않습니다.

```sh
cd services/voxcpm2
docker build -t victory-voxcpm2 .
# VOXCPM2_TOKEN 환경 변수를 서버의 비밀 관리 기능으로 먼저 설정합니다.
docker run -d --name victory-voxcpm2 --restart unless-stopped --gpus all \
  -p 127.0.0.1:8080:8080 \
  -e VOXCPM2_TOKEN \
  -v victory-voxcpm2-cache:/cache \
  victory-voxcpm2
```

첫 실행 시 모델을 다운로드하고 메모리에 올립니다. `/healthz`가 200을 반환해야 준비된 상태입니다.
동일 서버의 HTTPS reverse proxy가 `/synthesize`를 `127.0.0.1:8080/synthesize`로 전달하도록 설정합니다.
외부 요청 크기는 16KB, 동시 연결 수는 작게 제한하고, 요청 헤더·본문에 인증 키를 로그로 남기지 않습니다.
worker의 HTTP 포트를 인터넷에 직접 열지 않습니다. 관리형 GPU 서비스에서는 해당 서비스의 HTTPS ingress를 사용합니다.

인증된 요청 형식은 다음과 같습니다.

```http
POST /synthesize
Authorization: Bearer <서버에서 설정한 비밀 키>
Content-Type: application/json

{"text":"하나님은 사랑이시라.\n\n요한일서 4:8","style":"calm"}
```

`style`은 `calm`, `warm`, `clear` 중 하나이며 응답은 `audio/wav`입니다.
VoxCPM2의 Voice Design을 사용하므로 실제 목소리와 지시 준수 정도는 음성을 들어 확인해야 합니다.
이 기능은 업로드한 음성을 복제하는 기능이 아닙니다.

### 2. Firebase에 worker 연결

프로젝트 루트의 `functions/.env.victorychurch-665a9`에 실제 HTTPS endpoint를 설정합니다.
이 파일은 Git에 커밋하지 않습니다.

```dotenv
VOXCPM2_URL=https://YOUR-GPU-HOST/synthesize
```

동일한 비밀 키를 Firebase Secret Manager에 등록합니다. 아래 명령은 입력을 대화형으로 받습니다.

```sh
npx firebase-tools functions:secrets:set VOXCPM2_TOKEN --project victorychurch-665a9
```

등록 후 함수와 Hosting을 함께 배포해야 합니다. Hosting만 배포하면 새 API를 사용할 수 없습니다.
GPU 서버 연결과 배포 승인 후 실행합니다.

```sh
npm --prefix functions ci
npx firebase-tools deploy --only functions:ttsProxy,hosting --project victorychurch-665a9
```

기존 Storage bucket과 함수 서비스 계정의 객체 읽기·쓰기 권한을 사용합니다.
생성 파일은 `tts-cache/`에 저장하며 클라이언트는 직접 접근하지 않습니다.
기존 Storage 규칙의 기본 거부가 적용되므로 규칙을 공개로 바꿀 필요가 없습니다.

### 3. 운영 확인

1. 관리자에서 짧은 한국어 구절, 출처, 기간을 입력하고 자동 낭독으로 저장합니다.
2. 생성 완료 후 미리듣기로 발음과 톤을 확인합니다.
3. 메인 화면에서 읽어주기·중지·반복 재생을 확인합니다. 휴대폰에서도 확인합니다.
4. 녹음 파일을 업로드하고 해당 구절을 녹음 방식으로 저장해 순차 재생을 확인합니다.
5. 다시 자동 낭독으로 저장하면 녹음 파일을 삭제하지 않고도 TTS로 전환됩니다.

본문과 출처를 합쳐 1200자까지 생성합니다. 한국어 성경 인명·지명·장절 표기는 실청 검수가 필요합니다.
텍스트 또는 톤 변경은 새 캐시를 만듭니다. 날짜·설명만 바꾸면 기존 음성을 재사용합니다.
목소리 지시문이나 모델 버전을 바꿀 때에는 `functions/tts.js`와 `server.py`의 캐시 버전을 함께 올립니다.

프록시는 45초까지 생성 응답을 기다립니다. 초과 시 UI에 재시도 안내가 나옵니다.
worker는 연결 종료 후에도 생성한 결과를 디스크에 저장하므로, 완료된 뒤 재시도하면 캐시를 반환합니다.
긴 구절의 안정적인 첫 요청 처리가 필요하면 작업 큐 방식으로 확장해야 합니다.
GPU는 한 번에 하나만 생성하며, 다른 생성 요청은 429를 받아 잠시 후 재시도해야 합니다.
모델의 비정상 생성으로 24MB를 넘긴 오디오는 캐시하지 않습니다.
Storage와 worker의 생성 캐시는 자동 삭제하지 않습니다. 사용량을 확인하고 보존 정책을 별도로 설정합니다.

API는 요청의 임의 텍스트를 사용하지 않고 Firestore의 저장된 구절 ID로 본문·톤을 조회합니다.
기존 관리자/Firestore 쓰기 권한 구조는 유지됩니다. 현재 공개 쓰기 규칙은 진짜 관리자 인증을 제공하지 않으므로,
이 구조만으로 불특정 사용자의 구절 수정 및 생성 비용 발생을 완전히 방지하지는 못합니다.

## 로컬 검증

```sh
node --test tests/tts.test.cjs tests/tts-client.test.cjs tests/tts-player.test.cjs
python3 -m unittest discover -s services/voxcpm2 -p 'test_*.py'
node tests/tts-preview-server.cjs
```

마지막 명령은 `http://127.0.0.1:4179/admin`에서 관리자 테스트 화면을 엽니다.
Firebase 저장은 메모리로, GPU 응답은 테스트 WAV로 대체되며 실제 사이트 데이터에 쓰지 않습니다.
테스트 WAV는 1초짜리 소리 확인용 톤이며, 실제 MeloTTS/VoxCPM2 음질 테스트가 아닙니다.
