const router = require('express').Router();

/* 로그인 한 사람만 들어갈 수 있는 페이지 만들기 */
const checkLogined = (req, res, next) => {
  // 로그인 후 세션이 있으면 req.user가 항상 있음
  if (req.user) {
    next();
  } else {
    res.send('로그인 하시길 바랍니다.');
  }
};

/* 모든 라우터들에 적용할 수 있는 미들웨어 */
router.use(checkLogined);

router.get('/shirts', (req, res) => {
  res.send('셔츠');
});

router.get('/pants', (req, res) => {
  res.send('바지');
});

module.exports = router;
