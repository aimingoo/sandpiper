// -------------------------------------------------------------------------------------------------------
// simple resource center service for N4C
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.11
//
// The distributed processing module from NGX_4C architecture
// 	1) N4C is programming framework.
// 	2) N4C = a Controllable & Computable Communication Cluster architectur.
//
// start as daemon.
// -------------------------------------------------------------------------------------------------------
var log = console.log.bind(console)
var err = function(e) { console.log(e.stack || e) }

// systemPart:pathPart:scopePart
var default_config = {
	// for etcd
	systemName: 'sandpiper',
	baseResourcePath: '/com.wandoujia.n4c',
	etcdServer: "127.0.0.1:4001", // or services in a string array, or options object
	// for daemon
	clientAddr: "127.0.0.1:3232", // @see 'default_config.serverAddr' in ResourceCenter.js
	subscribePath: '/n4c/([^/]+)/subscribe',
	queryPath: '/n4c/([^/]+)/query'
}

var GLOBAL_CACHED_ITEMS = {};	// or, pure global dictionary.
var GLOBAL_CACHED_MAP = {};		// token-basePath pairs
var SIGN_INVALID = new String('INVALID RESOURCE');
var SIGN_EMPTY = JSON.stringify(new Array());

var crypto_crc = require('crc-32');
var CRC32 = function(c) {
	// @see http://www.nilennoct.com/javascript-crc32-fix/
	return function() { return (c.apply(this, arguments) >>> 0).toString(16) }
}(crypto_crc.str)

function etcd_filter(val, headers) {
	if (val.action != 'update') {
		this.emit('notify', val, headers)
	}
}

function resolve_resource(resources, resId) {
	return (resources[resId]
		|| (resources[resId] = {
			version: '1.0',
			updated: (new Date).valueOf(),
			value: SIGN_INVALID,
			subscriber: []
		}))
}

function promised_request(request, req) {
	return new Promise(function(resolve, reject) {
		request.get(this, function(err, response, body) {
			return err ? reject({error: err, headers: response && response.headers})
				: resolve({body: body, headers: response && response.headers});
		});
	}.bind(req));
}

function do_error_404(request, response) {
	var url = require('url'), urlObject = url.parse(request.url), uri = urlObject.pathname;
	var ERR_HTTP_HEADER = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
	response.writeHead(404, ERR_HTTP_HEADER);
	response.write(JSON.stringify({
		reason: "unknow url schema.",
		request: uri
	}));
	response.end()
}

function do_error_501(request, response) {
	var url = require('url'), urlObject = url.parse(request.url), uri = urlObject.pathname;
	var ERR_HTTP_HEADER = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
	response.writeHead(501, ERR_HTTP_HEADER);
	response.write(JSON.stringify({
		reason: "lost post data or error get request.",
		request: uri
	}));
	response.end()
}

function hasPrefix(str, prefix) {
	var len = prefix.length;
	return (str.length == len) ? str == prefix // same length
		: (str.length > len) && (str.substr(0, len) == prefix) // has prefix, and
			&& (str.charAt(len) == '/'); // tailed by '/'
}

// curl 'http://127.0.0.1:8033/sandpiper/notify?%2F127.0.0.1%3A8032'
function do_notify(val, headers) {
	/*** data schema:
		fullKey ex: 	/lighteyes/com.wandoujia.le/acccount/gp_ly/.127.0.0.1:8032
		directory ex: 	/lighteyes/com.wandoujia.le/acccount/gp_ly
			- the <directory> equ basePath equ baseResourcePath
		resources is: 	GLOBAL_CACHED_ITEMS[directory]
			- the <resources> equ LOCAL_CACHED
		key is: 		/.127.0.0.1:8032
			- the '/' is key for root
		resource is: 	GLOBAL_CACHED_ITEMS[directory][key], ...
		resId is: 		encodeURIComponent(key)
		dir in etcd is: /lighteyes/com.wandoujia.le/acccount/gp_ly/127.0.0.1:8032
	*/
	var etcd = this,
		steps = Promise.resolve(),
		fullKey = val.node.key,
		rx_key = /\/[^\/]+$/,
		notifyKey = fullKey.replace(rx_key, '') || '/'; // find activeKey's parent, as notifyKey
		willNotify = function(basePath) { return hasPrefix(notifyKey, basePath) };
	log('filted['+val.action+']:', fullKey);

	if (! val.node.dir) {
		Object.keys(GLOBAL_CACHED_ITEMS).filter(willNotify).forEach(function(directory){
			var resources = GLOBAL_CACHED_ITEMS[directory];
			var key = notifyKey.substr(directory.length) || '/';
			var resource = resources[key], users;
			if (users = resource && resource.subscriber) {
				var promises = [], resId = encodeURIComponent(key);
				resource.value = SIGN_INVALID; // need reget
				users.forEach(function(receive) {
					// search string as key, @see start_httpd() in ResourceCenter.js
					log(' ->', receive + '?' + resId, 'notified.')
					promises.push(promised_request(require('request'), {url: receive + '?' + resId}));
				})
				steps = steps.then(function() { Promise.all(promises).catch(err) });
			}
		})
	}

	var rx_worker = /\/\.([^\/]+)$/;
	if ((val.action == 'expire') && fullKey.match(rx_worker)) {
		var dir = fullKey.replace(rx_worker, '/$1'); // '.' char removing
		steps = steps.then(function() { // delete <dir> in etcd
			etcd.delete(dir, {dir: true, recursive: true}).catch(err)
		})
		log(' ->', dir, 'removed.')
	}
}

// curl 'http://127.0.0.1:3232/n4c/<TOKEN>/subscribe?/127.0.0.1:8032' --data '{"receive":"http://127.0.0.1:8033/sandpiper/notify"}'
function do_subscribe(request, response, resId, basePath, data) {
	if (!data || !data.receive) return do_error_501(request, response);

	var resources = GLOBAL_CACHED_ITEMS[basePath];
	var resource = resolve_resource(resources, resId);
	var users = resource.subscriber;
	if (users.indexOf(data.receive) < 0) {
		log('subscribe['+basePath+']:', resId, 'at', data.receive)
		users.push(data.receive);
	}

	this.emit('query', request, response, resId, basePath, data)
}

// curl 'http://127.0.0.1:3232/n4c/<TOKEN>/query?/127.0.0.1:8032'
function do_query(request, response, resId, basePath, data) {
	var etcd = this, resources = GLOBAL_CACHED_ITEMS[basePath];
	var done = function(value) { response.write(value); response.end() }
	var toExecuteUri = function(dir) { return etcd.get(dir + '/execute_task', {}).then(pickValue) }
	var isPublisher = function(key) { return this[key] }
	var isWorker = function(node) {
		var name = node.key.substr(node.key.lastIndexOf('/') + 1);
		return node.dir ? void(this['.'+name] = node.key)
			: (name.charAt(0) == '.') ? name
			: false;
	}

	var pickValue = function(result) {
		return (result && result.body && result.body.node && result.body.node.value)
			|| Promise.reject(SIGN_INVALID);
	}

	// curl -s 'http://127.0.0.1:4001/v2/keys/com.wandoujia.n4c' | jq .
	var resolve_value = function(resource) {
		function update_resource_2(values) {
			resource.updated = (new Date).valueOf();
			return resource.value = JSON.stringify(values.filter(Boolean));
		}
		function update_resource(result) {
			var node = result && result.body && result.body.node; // safed pickNode
			if (!node || !node.dir) return SIGN_EMPTY;

			var directories = {}, // defer fill in isWorker()
				workers = node.nodes.map(isWorker, directories).filter(Boolean),
				publishes = workers.map(isPublisher, directories).filter(Boolean);
			return Promise.all(publishes.map(toExecuteUri)).then(update_resource_2);
		}
		function ignore () {
			return update_resource()
		}
		return Promise.resolve((resource.value !== SIGN_INVALID) ? resource.value // or try again
			: etcd.get(basePath + (resId == '/' ? "" : resId), {}).then(update_resource).catch(ignore));
	}

	// TODO: check body data and other
	Promise.resolve(resolve_resource(resources, resId))
		.then(resolve_value)
		.then(done, err);
}

// prototype of Initializer
var taskObject = {
	promised: function(taskResult) {
		return true;  // return new result
	}
}

var basePathParser = function(base, path) {
	return (path.charAt(0) != '/') ? '/' + path
		: path.replace(/^\/\//, '/' + base + '/');
}

var local_distributed = function(options) {
	var options = options || {},
		taskObject = this,
		basePath = taskObject.groupBasePath,
		system = options.systemName || default_config.systemName;
	if (options.groupBasePath) {
		var watchAt = taskObject.groupBasePath; // from prototype
		basePath = basePathParser(system, options.groupBasePath);
		if (! hasPrefix(basePath, watchAt)) {
			throw new Error('error config in groupBasePath: ' + basePath)
		}
		// reset groupBasePath for current instance
		taskObject.groupBasePath = basePath;
	}

	// set local cached by per-instance
	GLOBAL_CACHED_MAP[CRC32(basePath)] = basePath;
	Object.defineProperty(taskObject, 'LOCAL_CACHED', {
		value: GLOBAL_CACHED_ITEMS[basePath] || (GLOBAL_CACHED_ITEMS[basePath] = {}),
		enumerable: false,
		writable: false
	})
}

function Initializer(options) {
	// check prototype
	if (! this.etcdServer) {
		try {
			Initializer.setWatcher()
		}
		catch(e) {
			console.log(e.stack || e)
		}; // ignore
		if (! this.etcdServer) throw new Error('Cant initialization etcdServer');
	}
	// copy members
	Object.keys(taskObject).forEach(function(key){
		this[key] = taskObject[key]
	}, this)
	// initialization with options
	local_distributed.call(this, options);
}

// call me before create instance once only
Initializer.setWatcher = function(options) {
	function OPT(key) {
		return options && options[key] || default_config[key]
	}

	// re-check
	if (Initializer.prototype.etcdServer) throw new Errro('setWatcher before create instance once only');

	// ectd for watcher
	var conf = OPT('etcdServer');
	if (typeof(conf) == 'object') {
		conf = (conf instanceof String) ? { hosts: [conf] }
			: (conf instanceof Array) ?  { hosts: conf }
			: conf;
	}
	else if (typeof(conf) == 'string') {
		conf = { hosts: [conf] }
	}
	else throw new Error('etcdServer options invalid');

	var EtcdPromise = require('node-etcd-promise');
	var system = OPT('system');
	var basePath = basePathParser(system, OPT('baseResourcePath'));

	var etcd = new EtcdPromise(conf.hosts, conf.sslopts, conf.client);
	var watcher = etcd.watcher(basePath, null, {recursive: true});
	var clientAddr = OPT('clientAddr');
	var daemon = Initializer.startDaemon({
		clientAddr: clientAddr,
		queryPath: basePathParser(system, OPT('queryPath')),
		subscribePath: basePathParser(system, OPT('subscribePath'))
	});
	watcher.on("change", etcd_filter);
	watcher.on("notify", do_notify.bind(etcd));
	watcher.on("stop", log);
	daemon.on("error", do_error_404);
	daemon.on("subscribe", do_subscribe);
	daemon.on("query", do_query.bind(etcd));

	Object.defineProperties(Initializer.prototype, {
		etcdServer: 		{ value: etcd, 		enumerable: false, writable: false },
	// 	registerWatcher: 	{ value: watcher, 	enumerable: false, writable: false },
	// 	registerDaemon: 	{ value: daemon, 	enumerable: false, writable: false },
		clientAddr: 		{ value: clientAddr,enumerable: false, writable: false },
		groupBasePath: 		{ value: basePath, 	enumerable: false, writable: true }
	})
}

// start daemon to invoke query/subscribe request
Initializer.startDaemon = function(conf) {
	var url = require("url"),
		actions = new (require('events').EventEmitter),
		port = parseInt(conf.clientAddr.split(':')[1] || '8032');
	var rx_all = [conf.queryPath, conf.subscribePath].map(function(str) {
		return new RegExp('^' + str.replace(/[^\/]+$/, '($&)$'));
	});

	var httpd = require("http").createServer(function(request, response) {
		var matched, urlObject = url.parse(request.url), uri = urlObject.pathname;
		for (var i=0, imax=rx_all.length; i<imax; i++) {
			if (matched = uri.match(rx_all[i])) break;
		}
		if (! matched) return actions.emit('error', request, response);

		var token = matched[1], basePath = GLOBAL_CACHED_MAP[token];
		if (! basePath) return actions.emit('error', request, response);

		// fire event with/without data
		var eventName = matched[2], resId = urlObject.search.replace(/^\?/, '');
		function processing(data) {
			actions.emit(eventName, request, response, decodeURIComponent(resId), basePath, data)
		}
		if (request.method == 'GET') return processing();

		// force data as json, convert to js object
		function asObject(str) {return JSON.parse(str) }
		// post with json data
		var promise = new Promise(function(resolve, reject) {
			var postData = "";
			request.on('data', function(data) { postData += data });
			request.on('end', function() { resolve(postData.toString()) });
		})
		promise.then(asObject).then(processing).catch(err)		
	}).listen(port);

	return httpd && actions;
}

// list directiries in GLOBAL_CACHED_ITEMS, the interface of <func>:
// 	- function f(token, basePath, resources)
Initializer.list = function(func) {
	for (var token in GLOBAL_CACHED_MAP) {
		var directory = GLOBAL_CACHED_MAP[token];
		func.call(this, token, directory, GLOBAL_CACHED_ITEMS[directory]);
	}
}

module.exports = Initializer;