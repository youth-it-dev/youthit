#!/bin/bash

###############################################################################
# 전체 리워드 정책 확인 테스트
# Usage: ./test-all-policies.sh
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 전체 리워드 정책 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$FUNCTIONS_DIR"

# Inline Node.js로 Notion 정책 조회
node -e "
require('dotenv').config();
const RewardService = require('./src/services/rewardService');

const policies = [
  { key: 'comment', name: '댓글 작성' },
  { key: 'routine_post', name: '루틴 인증글' },
  { key: 'routine_review', name: '루틴 후기글' },
  { key: 'gathering_review_media', name: '소모임 후기글' },
  { key: 'tmi_review', name: 'TMI 프로젝트 후기글' },
];

(async () => {
  try {
    const rewardService = new RewardService();
    
    console.log('🔍 Notion 정책 조회 중...\n');
    
    let allPassed = true;
    
    for (const policy of policies) {
      const reward = await rewardService.getRewardByAction(policy.key);
      
      if (reward > 0) {
        console.log(\`  ✅ \${policy.name} (key: \${policy.key}): \${reward} 포인트\`);
      } else {
        console.log(\`  ❌ \${policy.name} (key: \${policy.key}): 정책 없음 또는 비활성화\`);
        allPassed = false;
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (allPassed) {
      console.log('✅ 모든 정책이 정상 설정되어 있습니다!\n');
      process.exit(0);
    } else {
      console.log('❌ 일부 정책이 누락되거나 비활성화되어 있습니다.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
})();
"

EXIT_CODE=$?

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 전체 정책 확인 성공"
else
  echo "❌ 전체 정책 확인 실패 (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE

