
## 목표

- Web2 기반의 포인트 재화를 개발합니다.
- 블록체인 기반의 토큰을 개발합니다. 이 토큰은 거버넌스 토큰이며 투표 기능을 제공해야합니다.
- 포인트는 고정 비율로 토큰과 교환할 수 있습니다.
- 모든 기능을 테스트할 수 있는 웹 어플리케이션을 개발합니다.

## 메인넷

- Solana

## 참고사항

- 사용한 언어, 프레임워크, 코딩스타일, 개발환경을 사용한 이유를 명시해 주시면 좋습니다.
- 테스트 케이스를 작성해 주시면 좋습니다.
- 작성한 코드는 과제시험을 위해 실행 가능해야 합니다.
- 과제는 Pull Request를 통해 제출하면 됩니다.


===============================================================================

1. 계정

   - vote 컨트랙트용 owner : id.json  -> 
      주소 : 42M6ZbAQoEpjNvfHeiA5yFGjxv1RrgVaMbF758U76JD2
      programID : HQ24JdiocERDsdbnKxc5YM6Chr2wX4QDPWGYDhzsitcm

   - vote 시용할 token-mint 계정 : 
      주소 : Etud6v3NiGoArtAD6X8TVRqLtcvK7iaws5YbmmqQYf58
      spl-token : CKiHhNMtcrWMcc76JZCqUE6H6yXADfJFz4aqiYgHgG1o

   - 사용자 계정 지갑연결 : phantom

   - solana 컨트랙트 빌드 IDE : https://beta.solpg.io 사용


2. 프로젝트 요약 및 개발환경

- 사용 언어: Rust(Anchor, Solana 스마트컨트랙트), JavaScript(React/Next.js, Node.js)
- 프레임워크: Anchor(스마트컨트랙트), Next.js(프론트엔드), Express(백엔드)
- 코딩 스타일: camelCase사용,  환경변수(.env) 사용
- 개발환경: Docker, Node.js 18/20, Redis , Anchor CLI, Solana CLI, Phantom Wallet
- 선택 이유:
  - Anchor: Solana 스마트컨트랙트 개발의 표준, 테스트/배포/계정 관리가 편리함
  - Redis: 저장소로 사용 (지갑별 포인트 기록)
  - Next.js: React 기반 SSR/CSR 지원, 빠른 개발 및 유지보수
  - Express: 간단한 API 서버 구현에 적합
  - 환경변수: 운영/개발 환경 분리 및 보안성 강화
 
3. 실행 및 테스트 방법

- 환경변수(.env, .env.local) 예시 파일 참고
- backend, frontend, anchor 각각 Docker 또는 npm/yarn으로 실행 가능
- Anchor 테스트: anchor 디렉토리에서 `anchor test` 실행
- 프론트엔드: `npm run dev` (3000번 포트)
- 백엔드: `npm start` (4000번 포트)

4. 테스트 케이스

- anchor/tests.rs에 Rust 기반 통합 테스트 예제 포함 (create_poll, vote, reset_poll 등)
- 정상/실패 케이스 모두 포함 (실제 Anchor 환경에서 실행 가능)


PS.
블록체인관련해서 수년동안 업무를 한 상태지만 컨트랙트 개발관련 해서는 evm nft용 및 ca 지갑을 개발하는 작업 정도여서 코딩에 많은 부분은 cursor , chatgpt를 활용하였습니다. # sol_evm
