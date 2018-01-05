let dict = require('./translate');

function Tile(t) {
	let m = Math.floor(t / 36),
		d = t % 36,
		n = Math.floor(d / 4) + 1,
		res;
	switch (m) {
		case 0:
			res = 'm' + (d == 16 ? 'a' : n);
			break;
		case 1:
			res = 'p' + (d == 16 ? 'a' : n);
			break;
		case 2:
			res = 's' + (d == 16 ? 'a' : n);
			break;
		case 3:
			let s = Math.floor(d / 4);
			switch (s) {
				case 0:
					res = 'tan';
					break;
				case 1:
					res = 'nan';
					break;
				case 2:
					res = 'xia';
					break;
				case 3:
					res = 'pei';
					break;
				case 4:
					res = 'haku';
					break;
				case 5:
					res = 'hatsu';
					break;
				case 6:
					res = 'chun';
					break;
			}
			break;
	}
	return res;
}

function Hand(h) {
	return h.map(function(t) {
		return Tile(t);
	});
}

function replaceTiles(trg) {
	let res = trg;
	for (var r = 0; r < res.rounds.length; r++) {
		// обработка конечных рук
		for (var f = 0; f < res.rounds[r].finish.length; f++) {
			let finish = res.rounds[r].finish[f].sort(function(a, b) {
				return a - b;
			});
			res.rounds[r].finish[f] = Hand(res.rounds[r].finish[f]).slice();
		}
	}
	return res;
}

function decodeList(list, to_int, sort) {
	if (typeof sort === 'undefined') sort = false;
	let res = list.split(',');
	res = (to_int ? res.map(function(a) {
		return parseInt(a);
	}) : res);
	return (sort ? res.sort(function(a, b) {
		return a - b;
	}) : res);
}

function parseScore(data, mult) {
	let res = [];
	for (var i = 0; i < data.length / 2; i++) {
		res.push({
			begin: data[2 * i] * mult,
			diff: data[2 * i + 1] * mult,
			end: (data[2 * i] + data[2 * i + 1]) * mult
		});
	}
	return res;
}

function parseMeld(data) {
	if (data & 0x4) {
		return parse_chi(data);
	} else if (data & 0x18) {
		return parse_pon(data);
	} else if (data & 0x20) {
		return parse_nuki(data);
	} else {
		return parse_kan(data);
	}
}

function parse_chi(data) {
	let t0 = (data >> 3) & 0x3,
		t1 = (data >> 5) & 0x3,
		t2 = (data >> 7) & 0x3,
		base_and_called = data >> 10,
		base = Math.floor(base_and_called / 3),
		called = base_and_called - 3 * base;
	base = Math.floor(base / 7) * 9 + base % 7;
	return {
		type: 'chi',
		fromPlayer: (data & 0x3),
		called: called,
		tiles: [t0 + 4 * (base + 0), t1 + 4 * (base + 1), t2 + 4 * (base + 2)]
	};
}

function parse_pon(data) {
	let t4 = (data >> 5) & 0x3,
		arr = [
			[1, 2, 3],
			[0, 2, 3],
			[0, 1, 3],
			[0, 1, 2]
		],
		t0 = arr[t4][0],
		t1 = arr[t4][1],
		t2 = arr[t4][2],
		base_and_called = data >> 9,
		base = Math.floor(base_and_called / 3),
		called = base_and_called - 3 * base;
	if (data & 0x8) {
		return {
			type: 'pon',
			fromPlayer: (data & 0x3),
			called: called,
			tiles: [t0 + 4 * base, t1 + 4 * base, t2 + 4 * base]
		};
	} else {
		return {
			type: 'chakan',
			fromPlayer: (data & 0x3),
			called: called,
			tiles: [t0 + 4 * base, t1 + 4 * base, t2 + 4 * base, t4 + 4 * base]
		};
	}
}

function parse_kan(data) {
	let base_and_called = data >> 8,
		base = Math.floor(base_and_called / 4),
		called = base_and_called - 4 * base;
	return {
		type: 'kan',
		fromPlayer: (data & 0x3),
		called: called,
		tiles: [4 * base, 1 + 4 * base, 2 + 4 * base, 3 + 4 * base]
	};
}

function parse_nuki(data) {
	return {
		type: 'nuki',
		tiles: [data >> 8]
	};
}

function parseLog(namelog, file, lang) {
	return new Promise(function(resolve, reject) {
		var fs = require('fs'),
			xmlparser = require('htmlparser2');
		var parser = new xmlparser.Parser({
			onopentag: function(name, attribs) {
				switch (true) {
					case /mjloggm/.test(name):
						res = {
							log: namelog,
							players: [],
							rounds: []
						};
						break;
					case /un/.test(name) && (typeof attribs.sx !== 'undefined'):
						var sex = decodeList(attribs.sx),
							dan = decodeList(attribs.dan),
							rate = decodeList(attribs.rate);
						[0, 1, 2, 3].forEach(function(p) {
							res.players[p] = {
								name: decodeURIComponent(attribs['n' + p]),
								sex: sex[p],
								dan: parseInt(dan[p]),
								rate: parseFloat(rate[p]),
								connected: true
							};
						});
						break;
					case /bye/.test(name) && (typeof attribs.who !== 'undefined'):
						res.players[parseInt(attribs.who)].connected = false;
						break;
					case /taikyoku/.test(name) && (typeof attribs.oya !== 'undefined'):
						res.diler = parseInt(attribs.oya);
						break;
					case /init/.test(name) && (typeof attribs.oya !== 'undefined'):
						let seed = decodeList(attribs.seed);
						res.rounds.push({
							name: parseInt(seed[0]),
							honba: parseInt(seed[1]),
							riichi: {
								count: parseInt(seed[2]),
								player: []
							},
							d0: parseInt(seed[3]),
							d1: parseInt(seed[4]),
							dora: Hand([parseInt(seed[5])]),
							uradora: [],
							diler: parseInt(attribs.oya),
							hands: [],
							finish: [],
							meld: [
								[],
								[],
								[],
								[]
							],
							events: [
								[],
								[],
								[],
								[]
							]
						});
						cur_game = res.rounds.length - 1;
						cur_player = res.rounds[cur_game].diler;
						cur_event = -1;
						[0, 1, 2, 3].forEach(function(p) {
							res.rounds[cur_game].finish[p] = decodeList(attribs['hai' + p], true, true);
							res.rounds[cur_game].hands[p] = Hand(decodeList(attribs['hai' + p], true, true));
						});
						break;
					case /agari/.test(name) && (typeof attribs.ba !== 'undefined'):
						if (!res.rounds[cur_game].win) res.rounds[cur_game].win = [];
						let ten = decodeList(attribs.ten),
						    hand = decodeList(attribs.hai, true, true),
						    machi = decodeList(attribs.machi, true, false),
						    wintile = hand.indexOf(machi[0]),
							agari = {
								type: (attribs.fromwho != attribs.who ? 'ron' : 'tsumo'),
								player: parseInt(attribs.who),
								hand: Hand(hand),
								points: parseInt(ten[1]),
								fu: parseInt(ten[0]),
								dora: Hand(decodeList(attribs.dorahai, true, false)),
								machi: wintile
							};
						if (attribs.m) {
							agari.melds = [];
							decodeList(attribs.m, true, false).forEach(function(m) {
								agari.melds.push(parseMeld(m));
							});
							agari.closed = [];
							agari.melds.forEach(function(m) {
								m.tiles = Hand(m.tiles);
								if (!m.fromPlayer) {
									agari.closed.push(m);
								}
							});
						} else {
							agari.closed = true;
						}
						if (parseInt(ten[2]) > 0) {
							agari.limit = parseInt(ten[2]);
						}
						if (attribs.dorahaiura) {
							agari.uradora = Hand(decodeList(attribs.dorahaiura, true, false));
							res.rounds[cur_game].uradora = agari.uradora;
						}
						if (agari.type == 'ron') {
							agari.fromPlayer = parseInt(attribs.fromwho);
							res.rounds[cur_game].events[agari.fromPlayer][res.rounds[cur_game].events[agari.fromPlayer].length - 1].furikomi = 1;
						}
						if (attribs.yaku) {
							let yakus = decodeList(attribs.yaku);
							agari.yakulist = [];
							for (var y = 0; y < yakus.length / 2; y++) {
								agari.yakulist.push({
									yaku: parseInt(yakus[2 * y]),
									han: parseInt(yakus[2 * y + 1])
								});
							}
						} else if (attribs.yakuman) {
							agari.yakuman = decodeList(attribs.yakuman, true, true);
						}
						if (attribs.sc) {
							res.rounds[cur_game].score = parseScore(decodeList(attribs.sc, true, false), 100);
						}
						res.rounds[cur_game].win.push(agari);
						res.rounds[cur_game].finish[parseInt(attribs.who)] = [];
						break;
					case /ryuukyoku/.test(name) && (typeof attribs.ba !== 'undefined'):
						res.rounds[cur_game].draw = {};
						if (attribs.type) {
							res.rounds[cur_game].draw.type = attribs.type;
						}
						if (attribs.sc) {
							res.rounds[cur_game].score = parseScore(decodeList(attribs.sc, true, false), 100);
						}
						if (attribs.ba) {
							let ba = decodeList(attribs.ba, true, false);
							res.rounds[cur_game].draw.honba = ba[0];
							res.rounds[cur_game].draw.riichi = ba[1];
						}
						if (res.rounds[cur_game].draw || res.rounds[cur_game].draw.type === 'nm') {
							res.rounds[cur_game].draw.tenpai = [];
							[0, 1, 2, 3].forEach(function(p) {
								let hand = [];
								if (attribs['hai' + p]) {
									hand = Hand(decodeList(attribs['hai' + p], true, true));
									res.rounds[cur_game].finish[p] = [];
								}
								res.rounds[cur_game].draw.tenpai.push(hand);
							});
						}
						break;
					case /^[t-w]\d+/.test(name):
						let draw = /^([t-w])(\d+)$/.exec(name);
						cur_player = ['t', 'u', 'v', 'w'].indexOf(draw[1]);
						// Проверим тайл замены при кане
						if (res.rounds[cur_game].events[cur_player][cur_event] &&
							res.rounds[cur_game].events[cur_player][cur_event].call &&
							(res.rounds[cur_game].events[cur_player][cur_event].call.type === 'kan' ||
								res.rounds[cur_game].events[cur_player][cur_event].call.type === 'chakan')
						) {
							res.rounds[cur_game].events[cur_player][cur_event].draw = Tile(parseInt(draw[2]));
						} else {
							// начало ходов начинаем с дилера
							if (cur_player === res.rounds[cur_game].diler) cur_event++;
							res.rounds[cur_game].events[cur_player][cur_event] = {
								draw: Tile(parseInt(draw[2]))
							};
						}
						res.rounds[cur_game].finish[cur_player].push(parseInt(draw[2]));
						break;
					case /^[d-g]\d+/.test(name):
						let discard = /^([d-g])(\d+)$/.exec(name);
						cur_player = ['d', 'e', 'f', 'g'].indexOf(discard[1]);
						// Обработка цумогири
						if (!res.rounds[cur_game].events[cur_player][cur_event].call &&
							!res.rounds[cur_game].events[cur_player][cur_event].reach &&
							res.rounds[cur_game].events[cur_player][cur_event].draw == Tile(parseInt(discard[2]))) {
							delete res.rounds[cur_game].events[cur_player][cur_event].draw;
							res.rounds[cur_game].events[cur_player][cur_event].tsumogiri = Tile(parseInt(discard[2]));
						} else {
							res.rounds[cur_game].events[cur_player][cur_event].discard = Tile(parseInt(discard[2]));
						}
						// Уберем из финальной руки выкинутый тайл
						if (res.rounds[cur_game].finish[cur_player].indexOf(parseInt(discard[2])) >= 0) {
							res.rounds[cur_game].finish[cur_player].splice(
								res.rounds[cur_game].finish[cur_player].indexOf(parseInt(discard[2])), 1);
						}
						break;
					case /dora/.test(name) && (typeof attribs.hai !== 'undefined'):
						res.rounds[cur_game].events[cur_player][cur_event].dora = Tile(parseInt(attribs.hai));
						res.rounds[cur_game].dora.push(Tile(parseInt(attribs.hai)));
						break;
					case /n/.test(name) && (typeof attribs.m !== 'undefined'):
						let meld = parseMeld(attribs.m);
						meld.player = parseInt(attribs.who);
						// уберем из финальной руки сет
						for (var i = 0; i < meld.tiles.length; i++) {
							if (res.rounds[cur_game].finish[meld.player].indexOf(parseInt(meld.tiles[i])) >= 0) {
								res.rounds[cur_game].finish[meld.player].splice(
									res.rounds[cur_game].finish[meld.player].indexOf(parseInt(meld.tiles[i])), 1);
							}
						}
						meld.tiles = Hand(meld.tiles);
						if (meld.type != 'chakan') {
							// проверим нужно ли увеличить счетчик хода
							let tmp_meld = meld.player - res.rounds[cur_game].diler,
								tmp_player = cur_player - res.rounds[cur_game].diler;
							tmp_meld = (tmp_meld < 0 ? tmp_meld + 4 : tmp_meld);
							tmp_player = (tmp_player < 0 ? tmp_player + 4 : tmp_player);
							if (tmp_meld < tmp_player) {
								cur_event++;
							}
							meld.rotate = (meld.player - cur_player + 4) % 4;
							if (meld.type === 'pon') {
								meld.rotate--;
							} else if (meld.type === 'kan') {
								meld.rotate = [4, 0, 1, 3][meld.rotate];
							}
							res.rounds[cur_game].events[meld.player][cur_event] = {
								call: meld
							};
						} else {
							res.rounds[cur_game].meld[meld.player].forEach(function(item, i) {
								if (item.type === 'pon' && item.tiles[0] === meld.tiles[0]) {
									res.rounds[cur_game].meld[meld.player].splice(i, 1);
									meld.rotate = item.rotate;
								}
							});
							res.rounds[cur_game].events[meld.player][cur_event].call = meld;
						}
						res.rounds[cur_game].meld[meld.player].push(meld);
						cur_player = meld.player;
						break;
					case /reach/.test(name) && (typeof attribs.step !== 'undefined'):
						if (attribs.ten && attribs.step == 2) {
							res.rounds[cur_game].events[attribs.who][cur_event].reach = decodeList(attribs.ten, true, false);
							res.rounds[cur_game].riichi.player.push(parseInt(attribs.who));
						} else if (attribs.step == 1) {
							res.rounds[cur_game].events[attribs.who][cur_event].reach = [];
						}
						break;
				}
			},
			onclosetag: function(tagname) {
				if (tagname === 'mjloggm') {
					res = replaceTiles(res);
					resolve(res);
				}
			}
		}, {
			xmlMode: true,
			lowerCaseTags: true,
			lowerCaseAttributeNames: true
		});

		fs.readFile(file, function(err, data) {
			if (err) reject(err);
			parser.write(data);
		});
		parser.end();
	});
}

function workLog(req, res) {
	var url = require('url'),
		qs = require('querystring'),
		http = require('http'),
		fs = require('fs'),
		log, lang, json;
	if (req.method === 'POST') {
		var urlobj = url.parse(req.body.url),
			query = qs.parse(urlobj.query);
		log = query.log;
		lang = req.body.lang;
		json = req.body.json;
	} else if (req.method === 'GET') {
		log = req.query.log;
		lang = req.query.lang;
		json = req.query.json;
	}
	lang = (Object.keys(dict).indexOf(lang) >= 0 ? lang : 'en');
	if (!log) {
		res.status(200).send('Нужно передать URL на лог игры!!!');
	} else {
		var options = {
				host: 'e.mjv.jp',
				//host:  'e0.mjv.jp',
				port: 80,
				//followAllRedirects: true,
				path: '/0/log/plainfiles.cgi?' + log
				//path: '/0/log/?' + log
			},
			logfile = __dirname + '/tenhou/' + log + '.xml';
		if (!fs.existsSync(logfile)) {
			http.get(options, function(responce) {
				var body = '';
				responce.on('data', function(chunk) {
					body += chunk;
				});
				responce.on('end', function() {
					let fl = fs.openSync(logfile, 'wx');
					if (fl) {
						fs.writeSync(fl, body);
						fs.closeSync(fl);
					}
					if (fs.existsSync(logfile)) {
						parseLog(log, logfile, lang)
							.then(
								result =>
								(json === 1 ?
									res.status(200).json(result) : res.render('paifu', {
										data: result,
										str: dict[lang],
										lang: lang
									})),
								error => res.status(200).send('Error: ' + error)
							);
					}
				}).on('error', function(e) {
					log.error("Got error: " + e.message);
				});
			});
		} else {
			parseLog(log, logfile, lang)
				.then(
					result => (json == 1 ?
						res.status(200).json(result) : res.render('paifu', {
							data: result,
							str: dict[lang],
							lang: lang
						})),
					//res.status(200).json(result),
					error => res.status(200).send('Error: ' + error)
				);
		}
	}
}

exports.index = function(req, res) {
	if (!req.query.log) {
		res.render('index', {
			error: req.flash('error')
		});
	} else {
		workLog(req, res);
	}
};

exports.parse = workLog;