var express = require('express'),
	http = require('http'),
	favicon = require('serve-favicon'),
	morgan = require('morgan'),
	bodyParser = require('body-parser'),
	methodOverride = require('method-override'),
	cookieParser = require('cookie-parser'),
	cookieSession = require('cookie-session'),
	moment = require('moment'),
	flash = require('connect-flash'),
	mj = require('./routes/mj');

var app = express();

// all environments
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(favicon(__dirname + '/public/img/favicon.ico'));

morgan.token('now', function() {
	return moment().format('DD.MM.YY HH:mm:ss');
});
app.use(morgan(':now :req[x-forwarded-for] :method :url :status :res[content-length] - :response-time ms'));

app.use(bodyParser.urlencoded({
	extended: false
}));

app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(cookieParser());
app.use(cookieParser('z vfktymrfz kjiflrf'));
app.use(cookieSession({
	secret: 'z vfktymrfz kjiflrf'
}));

app.use(flash());

app.route('/').get(mj.index).post(mj.parse);
app.get('/get_log', function(req, res) {
	res.render('get_log');
});
app.get('/tiles', function(req, res) {
	res.render('tiles_svg');
});

app.use(function(req, res) {
	res.render('404');
});

var server = http.createServer(app);
server.listen(8081);