# Pyloid JS SDK

타입스크립트로 작성된 Pyloid JavaScript SDK입니다.

## 설치

```bash
npm install pyloid-js
```

## 사용 방법

```typescript
import { PyloidClient } from 'pyloid-js';

const client = new PyloidClient({
  apiKey: 'your-api-key'
});

// SDK 기능 사용
```

## 개발

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run build

# 테스트 실행
npm test

# 린트 검사
npm run lint
```

## 라이센스

ISC 