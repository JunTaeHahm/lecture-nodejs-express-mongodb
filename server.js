/* 서버 오픈 기본 문법 */
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // ejs사용

app.use('/public', express.static('public')); // static파일용 public폴더 정의

let db;
MongoClient.connect(process.env.DB_URL, (err, client) => {
  // 에러 발생 시
  if (err) return console.dir(err);

  // 'todoapp'이라는 db에 접근
  db = client.db('todoapp');

  // DB연결 시 작동 되는 코드
  app.listen(process.env.PORT, () => {
    console.log('listening 3000');
  });
});

/* data-json */
app.use(express.json());
const cors = require('cors'); // npm i -D cors
app.use(cors({ credentials: true }));

app.get('url', (req, res) => {
  res.json({ key: 'value' });
});

/* 경로 */
app.use(express.static(path.join(__dirname, '')));

app.get('/', (req, res) => {
  res.render('index.ejs', {});
});

app.get('/write', (req, res) => {
  res.render('write.ejs', {});
});

/* 경로에 파라미터 사용 */
app.get('/detail/:id', (req, res) => {
  db.collection('post').findOne({ _id: parseInt(req.params.id) }, (err, result) => {
    if (err) console.log(err);
    console.log(result);
    res.render('detail.ejs', { data: result });
  });
});

/* DELETE */
app.delete('/delete', (req, res) => {
  const { body, user } = req;
  console.log(body);
  body._id = parseInt(body._id);

  /* db 컬렉션 삭제 : 삭제할 객체, 콜백*/
  db.collection('post').deleteOne({ _id: body._id, user: user._id }, (err, result) => {
    if (err) console.log(err);
    console.log('DB에서 삭제 완료');
    res.status(200).send({ message: '삭제했습니다' }); // 응답방법
  });
});

app.get('/list', (req, res) => {
  /* 'post'의 모든 db데이터 가져오기 */
  db.collection('post')
    .find()
    .toArray((err, result) => {
      if (err) console.log(err);
      console.log(result);
      res.render('list.ejs', { posts: result }); // list.ejs 파일 렌더 (object로 넣어야함)
    });
});

/* UPDATE */
app.get('/edit/:id', (req, res) => {
  db.collection('post').findOne({ _id: parseInt(req.params.id) }, (err, result) => {
    if (err) console.log(err);
    console.log(result);
    res.render('edit.ejs', { post: result });
  });
});

app.put('/edit', (req, res) => {
  const { id, title, date } = req.body;
  db.collection('post').updateOne(
    { _id: parseInt(id) },
    { $set: { title, date } },
    (err, result) => {
      if (err) console.log(err);
      console.log(result);
      console.log('수정완료');
      res.redirect('/list');
    },
  );
});

/* session 방식 로그인 기능 */
const passport = require('passport');
const LocalStrategy = require('passport-local');
const session = require('express-session');

// 미들웨어 : 요청-응답 중간에 실행되는 코드
app.use(session({ secret: 'sessiontest', resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
  res.render('login.ejs', {});
});

/* 로그인 시 인증해주는 기능 authenticate */
// passport.authenticate('로컬경로',{failureRedirect:/실패했을때 경로})
app.post('/login', passport.authenticate('local', { failureRedirect: '/fail' }), (req, res) => {
  res.redirect('/');
});

/* 로그인 한 사람만 들어갈 수 있는 페이지 만들기 */
const checkLogined = (req, res, next) => {
  // 로그인 후 세션이 있으면 req.user가 항상 있음
  if (req.user) {
    next();
  } else {
    res.send('로그인 하시길 바랍니다.');
  }
};

app.get('/mypage', checkLogined, (req, res) => {
  res.render('mypage.ejs', { user: req.user });
});

/* 세션 생성하기 */
passport.use(
  new LocalStrategy(
    {
      usernameField: 'id', // form태그의 id name을 가진 값
      passwordField: 'pw', // form태그의 pw name을 가진 값
      session: true, // 로그인 후 세션을 저장 할 것인지
      passReqToCallback: false,
    },
    (userId, userPw, done) => {
      //console.log(userId, userPw);
      db.collection('login').findOne({ id: userId }, (err, result) => {
        if (err) console.log(err);

        // done(serverError, userDBdata(성공 시), errorMessage)
        if (!result) return done(null, false, { message: '존재하지 않는 아이디입니다.' });
        if (userPw === result.pw) {
          return done(null, result);
        } else {
          return done(null, false, { message: '비밀번호가 틀렸습니다.' });
        }
      });
    },
  ),
);
// id를 이용해서 세션을 저장시키는 코드 (로그인 성공 시 작동)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 로그인한 유저의 개인정보를 DB에서 찾는 코드
passport.deserializeUser((id, done) => {
  db.collection('login').findOne({ id: id }, (err, result) => {
    done(null, result);
  });
});

/* 쿼리스트링으로 검색하기 */
app.get('/search', (req, res) => {
  const { key } = req.query;
  let searchCondition = [
    {
      $search: {
        index: 'titleSearch', // MongoDB에서 만든 인덱스명
        text: {
          query: key,
          path: 'title', // 두개 이상 찾고싶으면 이어서 작성
        },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 10 },
    { $project: { title: 1, _id: 0, score: { $meta: 'searchScore' } } },
  ];
  db.collection('post')
    // aggregate : MongoBD searchDB사용 시
    .aggregate(searchCondition)
    .toArray((err, result) => {
      console.log(result);
      res.render('search.ejs', { posts: result });
    });
});

app.post('/register', (req, res) => {
  const { id, pw } = req.body;
  db.collection('login').insertOne({ id, pw }, (err, result) => {
    res.redirect('/');
  });
});

app.post('/add', (req, res) => {
  const { date, title } = req.body;
  const { _id } = req.user;
  res.send('서버에 전송완료');

  /* query문으로 원하는 데이터 찾기 */
  db.collection('counter').findOne({ name: '게시물 수' }, (err, result) => {
    console.log(result.totalPost);
    let count = result.totalPost; // 게시물 수를 변수로 데이터 할당해서 사용하기

    /* CREATE */
    /* db 컬렉션 추가 object형식으로 데이터 보내기 */
    db.collection('post').insertOne({ _id: count + 1, user: _id, title, date }, (err, result) => {
      console.log('DB에 저장 완료');

      /* db 컬렉션 업데이트 : 객체, 변경할 값, 콜백 */
      db.collection('counter').updateOne(
        { name: '게시물 수' },
        { $inc: { totalPost: 1 } },
        (err, result) => {
          if (err) console.log(err);
        },
      );
    });
  });
});

app.use('/shop', require('./routes/shop.js'));
app.use('/board/sub', require('./routes/board.js'));

/* 파일 저장 및 이름 변경 */
let multer = require('multer');
let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

let upload = multer({ storage: storage });

app.get('/upload', (req, res) => {
  res.render('upload.ejs', {});
});
app.post('/upload', upload.single('fileupload'), (req, res) => {
  console.log(res.body);
  res.send('파일 업로드 완료');
});
app.get('/image/:imgageName', (req, res) => {
  res.sendFile(__dirname + '/public/images' + req.params.imgageName);
});

/* 채팅방 구현 */

const { ObjectId } = require('mongodb');

app.post('/chatroom', checkLogined, (req, res) => {
  const { title, ohterId } = req.body;
  const { _id } = req.user;
  const chat = {
    title: 'chatRoomTitle',
    member: [_id, ObjectId(ohterId)],
    date: new Date(),
  };
  db.collection('chatroom').insertOne(chat, (err, result) => {
    if (err) console.log(err);
    res.send('채팅방 입장 성공');
  });
});
app.get('/chat', checkLogined, (req, res) => {
  const { _id } = req.user;

  db.collection('chatroom')
    .find({ member: _id })
    .toArray()
    .then((err, result) => {
      res.render('chat.ejs', { data: result });
    });
});

app.get('url', checkLogined, (req, res) => {
  res.writeHead(200, {
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  res.write('event: test\n') // 보낼 데이터 이름
  res.write('data: test\n\n') // 보낼 데이터
});
