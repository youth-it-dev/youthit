const CommentService = require("../services/commentService");

// 서비스 인스턴스 생성
const commentService = new CommentService();

class CommentController {
  /**
   * 댓글 생성 API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async createComment(req, res, next) {
    try {
      const {communityId, postId} = req.params;
      const {uid: userId} = req.user;
      const commentData = req.body;

      const result = await commentService.createComment(communityId, postId, userId, commentData);

      // 리워드 부여 (댓글 작성)
      await req.grantReward('comment', {
        commentId: result.id,
        postId,
        communityId,
      });

      return res.created(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 댓글 목록 조회 API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getComments(req, res, next) {
    try {
      const {communityId, postId} = req.params;
      const page = parseInt(req.query.page, 10) || 0;
      const size = Math.min(parseInt(req.query.size, 10) || 10, 10); 

      const viewerId = req.user?.uid || null;
      const result = await commentService.getComments(communityId, postId, {page, size}, viewerId);
      
      // data 객체 안에 comments 배열과 pagination 객체 분리
      const responseData = {
        comments: result.content || [],
        pagination: result.pagination || {}
      };
      
      if (result.commentAuthorName !== undefined) {
        responseData.commentAuthorName = result.commentAuthorName;
      }
      
      return res.success(responseData);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 댓글 수정 API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async updateComment(req, res, next) {
    try {
      const {commentId} = req.params;
      const updateData = req.body;
      const userId = req.user.uid;

      const result = await commentService.updateComment(commentId, updateData, userId);
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 댓글 삭제 API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async deleteComment(req, res, next) {
    try {
      const {commentId} = req.params;
      const userId = req.user.uid;

      await commentService.deleteComment(commentId, userId);
      return res.noContent();
    } catch (error) {
      return next(error);
    }
  }

  /**
   * 댓글 좋아요 토글 API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async toggleCommentLike(req, res, next) {
    try {
      const {commentId} = req.params;
      const {uid: userId} = req.user;

      const result = await commentService.toggleCommentLike(commentId, userId);
      return res.success(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new CommentController();
