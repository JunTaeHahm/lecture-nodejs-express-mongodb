const router = require('express').Router();

router.get('/sports', (req, res) => {
  res.send('스포츠');
});
router.get('/game', (req, res) => {
  res.send('게임');
});

module.exports = router;
