'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const util = require('./handler-util');
const Post = require('./post');

const trackingIdKey = 'tracking_id';

function handle(req, res) {
  const cookies = new Cookies(req, res);
  addTrackingCookie(cookies);

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order:[['id', 'DESC']]}).then((posts) => {
        res.end(pug.renderFile('./views/posts.pug', { posts, user: req.user }));
        console.info(
          `閲覧されました:
          user: ${req.user}, 
          trackingId: ${cookies.get(trackingIdKey) },
          remoteAddress: ${req.socket.remoteAddress},
          userAgent: ${req.headers['user-agent']} `
        );
      });
      break;
    case 'POST':
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        const params = new URLSearchParams(body);
        const content = params.get('content');
        console.info('投稿されました: ' + content);
        Post.create({
          content,
          trackingCookie: cookies.get(trackingIdKey),
          postedBy: req.user
        }).then(() => {
          handleRedirectPosts(req, res);
        });
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}
//自分が投稿した内容を削除できる関数を作成
function handleDelete(req, res){
  switch(req.method){
    //POSTメソッドの時だけ以降の処理が呼ばれるように実装(pugのimputで設定したnameとvalueデータを配列に入れ、URIエンコードをデコードしたものをparamsに格納)
    case 'POST':
      //削除する投稿idデータを受け取る配列を定義
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        console.log(`これが文字列に変換して繋いだbodyのデータ: ${body}`);
        const params = new URLSearchParams(body);
        //paramsオブジェクトの中にあるキー'id'の値を変数idに格納
        const id = params.get('id');
        //findByPk(ファインドバイプライマリーキー)はsequelizeのデータを取得する時に使う。ここではidで、データベース内にあるそのユーザーが投稿したものを取得し、postに格納。そしてそのpostに入ったデータを投稿したユーザーと今のユーザーが同じかサーバ側でもチェックし、同じであればデータベースから削除。そしてhandleRedirectPosts関数に繋げてリダイレクトする
        Post.findByPk(id).then((post) => {
          if (req.user === post.postedBy){
            post.destroy().then(() => {
              console.info(
                `${id}番目の投稿が削除されました:
                user: ${req.user},
                remoteAddress: ${req.socket.remoteAddress},
                userAgent: ${req.headers['user-agent']}`
                )
              handleRedirectPosts(req, res);
            });
          }
        });
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function addTrackingCookie(cookies) {
  if (!cookies.get(trackingIdKey)) {
    const trackingId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
  }
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

module.exports = {
  handle,
  handleDelete
};
