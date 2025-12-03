const BASE_URL = "https://youth-it.vercel.app";

const NOTIFICATION_LINKS = {
  POST: (postId, communityId) => `${BASE_URL}/community/post/${postId}?communityId=${communityId}`,
  MISSION_POST: (postId) => `${BASE_URL}/community/mission/${postId}`,
  PROGRAM: (programId) => `${BASE_URL}/programs/${programId}`,
};

module.exports = { BASE_URL, NOTIFICATION_LINKS };

