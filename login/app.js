var inChatRoom = false;
// node.jsのプラグインexpressを読み込む
const express = require('express')
var cookieParser = require('cookie-parser');
var http = require('http');
const app = express();
const port = 3000;

// サーバーの設定
var server = http.createServer(app);
server.listen(port);

// socketIOを呼び出せるようにioを定義
var io = require('socket.io')(server);

// クッキー
app.use(cookieParser())
app.get('/', (req, res, next) => {
  res.sendFile(__dirname + '/html/index.html');
  // res.json(req.cookies)
  console.log("Hello")
  var begginer = req.cookies.begginer || Math.random();
  res.cookie('begginer', begginer);
  //res.send('Begginer value: ' + begginer);
})

app.use(express.static('html'))

//パスワードハッシュ化
const bcrypt = require("bcrypt");

// MariaDBの設定
const mariadb = require("mariadb/callback");
const { Socket } = require('socket.io');
const { getSystemErrorMap } = require('util');
const conn = mariadb.createConnection({
  host: "localhost",
  user: "root",
  //password: "pass",
  //####DBname
  database: "login",
});
DBreset_log();

var arrayemo = new Array;

arrayemo = [0, 0, 0];

// **socketIO接続時**
// connectionがonのとき動作
io.on('connection', function (socket) {     // クライアントから値を受け取る
  socket.on('check_cookie', function (val) {
    DBsearch_cookie(val);
  });
  socket.on('logout_cookie', function (val) {
    DBremove_cookie(val);
  });
  socket.on('login_cookie', function (val) {
    socket.cookie = val;
  });
  socket.on('login_Uname', function (val) {
    socket.userName = val;
  });
  socket.on('login_Temperature', function (val) {
    socket.Temperature = val;
  });

  socket.on('login_Temperature_date', function (val) {
    socket.date = val
  });
  socket.on('login_Temperature_time', function (val) {
    socket.time = val
  });


  socket.on('addUser_num', function (val) {
    socket.num = val;
  });
  socket.on('addUser_Uname', function (val) {
    socket.userName = val;
  });
  socket.on('login_pass', function (val) {
    DBsearchTo_table(socket.userName, val, socket.cookie, socket.Temperature, socket.date, socket.time, socket.userName);
  });
  socket.on('addUser_pass', function (val) {
    DBsearch_User(socket.num, socket.userName, val);
  });

  socket.on('emot', function (val) {
    function OnButtonClick() {
      console.log("req_emo");
      io.emit('chart', val);
    }
    console.log;
    arrayemo = [0, 0, 0];
    OnButtonClick();
    var emit_array = () => {
      socket.emit("emot", arrayemo);
    }
    setTimeout(emit_array, 1000);
  });

  //chart
  socket.on('chart', function (val) {
    console.log(socket.name + ": emo = " + val);
    switch (val) {
      case 1: arrayemo[0] += 1;
        break;
      case 2: arrayemo[1] += 1;
        break;
      case 3: arrayemo[2] += 1;
        break;
    }
  });

  socket.on('enter', function (roomname) {
    socket.join(roomname);
    console.log('id=' + socket.id + ' enter room=' + roomname);
    setRoomname(roomname);
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      console.log('===== message broadcast to room -->' + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    }
    else {
      console.log('===== message broadcast all');
      socket.broadcast.emit(type, message);
    }
  }
  // When a user send a SDP message
  // broadcast to all users in the room
  socket.on('message', function (message) {
    var date = new Date();
    message.from = socket.id;
    console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

    // get send target
    var target = message.sendto;
    if (target) {
      console.log('===== message emit to -->' + target);
      socket.to(target).emit('message', message);
      return;
    }

    // broadcast in room
    emitMessage('message', message);
  });

  // When the user hangs up
  // broadcast bye signal to all users in the room
  socket.on('disconnect', function () {
    // close user connection
    console.log((new Date()) + ' Peer disconnected. id=' + socket.id);

    // --- emit ----
    emitMessage('user disconnected', { id: socket.id });

    // --- leave room --
    var roomname = getRoomname();
    if (roomname) {
      socket.leave(roomname);
    }
  });

  // DBFunction
  // searchTo_table
  function DBsearchTo_table(user, pass, cookie, Temperature, date, time, userName) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("searchTo_table");
        // ログイン情報を照会する
        conn.query("SELECT * FROM userdata_table WHERE BINARY name = '" + user + "'", (err, rows, meta) => {
          if (err) {
            console.log("!ユーザーネームが不正_login!");
            socket.emit('Login', false);
            return;
            //conn.end();
          }
          if (rows.length == 0) socket.emit('Login', false);
          rows.forEach((element) => {
            //整合性確認
            async function passhash_reverse(password) {
              const compared = await bcrypt.compare(pass, password);

              if (compared) {
                console.log("ユーザーネーム・パスワードが合致");
                // ログイン成功とbooleanで送信
                socket.emit('Login', true);
                DBinsert_cookie(cookie, user);
                DBinsert_health(Temperature, date, time, userName);
              } else {
                console.log("ユーザーネーム・パスワードが合致していません");
                socket.emit('Login', false);
              }
            }
            passhash_reverse(element.pass);
          });
        });
      }
    });
  }


  // DBsearch_User
  function DBsearch_User(num, user, pass) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("DBsearch_User");
        // ログイン情報を照会する
        conn.query("SELECT * FROM userdata_table WHERE BINARY name = '" + user + "'", (err, rows, meta) => {
          if (err) {
            console.log("!ユーザーネームが不正_adduser");
            socket.emit('AddUser', false);
            return;
            //conn.end();
          }
          var test = false;
          rows.forEach((element) => {
            test = true;
          });
          if (!test) {
            console.log("OK");
            //暗号化
            async function passhash(pass) {
              var password = await bcrypt.hash(pass, 10);
              DBinsert_test(num, user, password)
            }
            passhash(pass);
          } else {
            console.log("NO");
            socket.emit('AddUser', false);
          }
        });
      }
    });
  }

  //insert_test
  //testテーブルにチャットログを挿入する
  function DBinsert_test(num, Uname, pass) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("insert_test");
        conn.query("insert into userdata_table(num,name,pass) values('" + num + "','" + Uname + "','" + pass + "')", (err, res) => {
          if (err) {
            console.log("学籍番号が不正_adduser");
            socket.emit('AddUser', false);
            return;
            //conn.end();
          }
          // AddUser成功とbooleanで送信
          socket.emit('AddUser', true);
        });
      }
    });
  }

  //insert_health
  function DBinsert_health(Temperature, date, time, name) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("insert_health");
        conn.query("SELECT * FROM userdata_table WHERE name = '" + name + "'", (err, rows, meta) => {
          rows.forEach((element) => {
            console.log(element.num + "num");
            test(Temperature, date, time, element.num,name)
          });
        });
      }
    });
    function test(Temperature, date, time, usernum,name) {
      conn.connect((err) => {
        if (err) {
          console.log("Not connect!");
          conn.end();
        } else {
          conn.query("insert into health_table(Temperature,date, time,num,name) values('" + Temperature + "','" + date + "','" + time + "','" + usernum + "','" +name+"')", (err, res) => {
            if (err) {
              console.log("体温の保存に失敗しました");
              return;
            }
          });
        }
      });
    }
  }

  //insert_log
  //ログテーブルにチャットログを挿入する
  function DBinsert_log(Uname, msg) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("insert_log");
        conn.query("insert into log_Table(username,msg) values('" + Uname + "','" + msg + "')", (err, res) => {
          if (err) {
            console.log("ログ挿入に失敗_chat");
            return;
            //conn.end();
          }
        });
      }
    });
  }

  //insert_cookie
  //onlineテーブルにcookieを挿入する
  function DBinsert_cookie(cookie, user) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("insert_cookie");
        conn.query("insert into online_Table(cookie,username) values('" + cookie + "','" + user + "')", (err, res) => {
          if (err) {
            console.log("クッキー挿入に失敗_login");
            return;
            //conn.end();
          }
        });
      }
    });
  }

  // logout
  function DBremove_cookie(cookie) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("logout_cookie");
        // online情報を照会する
        conn.query("DELETE FROM online_table WHERE cookie = '" + cookie + "'", (err, rows, meta) => {
          if (err) {
            console.log("ログアウト処理に失敗_logout");
            return;
            //conn.end();
          }
        });
      }
    });
  }

  // search_cookie
  function DBsearch_cookie(cookie) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("searchTo_table");
        // online情報を照会する
        var login_success = false;
        conn.query("SELECT * FROM online_table WHERE cookie = '" + cookie + "'", (err, rows, meta) => {
          rows.forEach((element) => {
            socket.emit('Login', element.username);
            login_success = true;
            socket.userName = element.username;
          });
          console.log(login_success)
          if (!login_success) {
            socket.emit('Login', false);
          }
        });
      }
    });
  }

  // チャット受信時の処理
  socket.on('chat', function (msg) {
    io.emit('chat', socket.userName + ': ' + msg);
    DBinsert_log(socket.userName, msg)
  });

  // ログ送信の要求があった時
  socket.on('LOG', function (rec) {
    // ログ取り出し
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        console.log("select_log");
        conn.query("select * from log_TABLE", (err, rows, meta) => {
          rows.forEach((element) => {
            socket.emit('LOG', element.userName + ": " + element.msg);
          });
        });
      }
    });
  });
  //新しくHTML新しく作り
  //テーブルタグに挿入
  socket.on('health_LOG', function (num) {
    conn.connect((err) => {
      if (err) {
        console.log("Not connect!");
        conn.end();
      } else {
        conn.query("select * from health_TABLE order by num asc, date desc, time desc,Temperature asc", (err, rows, meta) => {
          rows.forEach((element) => {
            var tmp = [element.num, element.Temperature, element.date + element.time, element.date, element.time, element.name,0];
            socket.emit('health_LOG', tmp);
          });
        });
        conn.query("select * from health_TABLE order by num asc, date desc,Temperature desc", (err, rows, meta) => {
          rows.forEach((element) => {
            var tmp = [element.num, element.Temperature, element.date + element.time, element.date, element.time, element.name,1];
            socket.emit('health_LOG', tmp);
          });
        });
      }
    });
  });
});


// ログを保存しているテーブルを初期化
function DBreset_log() {
  conn.connect((err) => {
    if (err) {
      console.log("Not connect!");
      conn.end();
    } else {
      console.log("reset_log");
      conn.query("truncate table log_table", (err, meta) => {
        //conn.end();
      });
      conn.query("truncate table online_table", (err, meta) => {
        //conn.end();
      });
    }
  });
}