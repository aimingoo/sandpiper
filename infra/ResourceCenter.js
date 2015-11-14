// -------------------------------------------------------------------------------------------------------
// simple resource center client for N4C
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// Usage:
//	var Center = require('./lib/ResourceCenter.js');
//	var Distributed = require('./Distributed.js');
//	var opt = { resource_status_center: new Center({}) };
//	var n4c = new Distributed(opt);
//	...
// -------------------------------------------------------------------------------------------------------
var log = console.log.bind(console);
var err = function(e) { console.log(e.stack || e) };

var default_config = {
	// for server
	systemName: 'sandpiper',
	serverAddr: '127.0.0.1:3232',
	groupBasePath: '/com.wandoujia.n4c',
	headers: { "Content-Type": "text/plain; charset=UTF-8" },
	subscribePath: '/n4c/${token}/subscribe',
	queryPath: '/n4c/${token}/query',

	// for per-clients
	clientAddr: '127.0.0.1:8033',	// notify addr:port
	clientVersion: '1.1',
	notifyPath: '//notify',
	initialized: false
}

// curl -s -L 'http://127.0.0.1:4001/v2/keys/com.wandoujia.n4c?dir=true&recursive=true' -XDELETE
var GLOBAL_CACHED_RESOURCES = {}

/* ------------------------------------------------------------------------------------------------------
 * internal interfaces for resource center c/s
 * ----------------------------------------------------------------------------------------------------*/
function promised_request(request, req) {
	return new Promise(function(resolve, reject) {
		request.post(this, function(err, response, body) {
			var error = err || response.statusCode < 200 || response.statusCode >= 300
			return error ? reject({error: err || response.statusCode, body: body, headers: response && response.headers})
				: resolve({body: body, headers: response && response.headers});
		});
	}.bind(req));
}

function internal_start_notify(center, key) {
	function start_httpd() {
		var url = require("url");
		var port = parseInt(center.clientAddr.split(':')[1] || '8033');
		require("http").createServer(function(request, response) {
			var urlObject = url.parse(request.url);
			if (urlObject.pathname == center.notifyPath) {  // reset always, for any key
				var key = urlObject.search,	// search string is key
					parts = [center.systemName, center.groupBasePath + (key == '/' ? '' : key)].join(':');
				delete GLOBAL_CACHED_RESOURCES[parts];
				response.write('Okay');
			}
			response.end();
		}).listen(port);
		return true;
	}
	// var parts = [center.systemName, center.groupBasePath + (key == '/' ? '' : key)].join(':');
	// GLOBAL_CACHED_RESOURCES[parts] = null;  // TODO: initialization cached resource.
	return Promsie.resolve(center.initialized
		|| (center.initialized = start_httpd()));
}

function internal_query(center, key) {
	var opt = center, req  = {
		url: opt.rest_query + '?' + key,
		headers: opt.request_headers,
		body: JSON.stringify({
			type: 'scope',
			version: opt.clientVersion
		})
	};
	return promised_request(center.request, req)
}

function internal_subscribe(center, key) {
	var opt = center, req  = {
		url: opt.rest_subscribe + '?' + key,
		headers: opt.request_headers,
		body: JSON.stringify({
			type: 'scope',
			version: opt.clientVersion,
			receive: opt.rest_notify + '?' + key
		})
	};
	return promised_request(center.request, req)
}

/* ------------------------------------------------------------------------------------------------------
 * internal require with cache
 * ----------------------------------------------------------------------------------------------------*/
function internal_require(center, parts) {
	function try_cache_resource(res) {
		if (res.dynamic && res.subscribe) {
			// TODO: dynamic, subscribe and flush cache by remote
			return center.subscribe(key); // subscribe, non-blocking
		}
		else {
			// static, flush once
			var response = JSON.parse(res.body);
			return GLOBAL_CACHED_RESOURCES[parts] = response; // 写缓存
		}
	}
	// paraments/variants:
	//	- the <parts> is pathPart from fullKey, ex: 
	//		fullKey = 'lighteyes:/lighteyes/com.wandoujia.n4d/acccount/gp_ly:*'
	//		parts = 'lighteyes:/lighteyes/com.wandoujia.n4c/acccount/gp_ly'
	//		pathPart = '/lighteyes/com.wandoujia.n4c/acccount/gp_ly'
	//  - the <groupBasePath> of current center is:
	//		center.groupBasePath = '/lighteyes/com.wandoujia.n4c/acccount/gp_ly',
	var rx_system = '^[^:]+', systemPart = (parts.match(rx_system) || [])[0];
	var fullKey = systemPart && parts.substr(systemPart.length+1);
	var key = fullKey.replace(center.groupBasePath, '') || '/';
	return center.query(key).then(try_cache_resource);
}

/* ------------------------------------------------------------------------------------------------------
 * Constructor and interfaces of n4c
 * ----------------------------------------------------------------------------------------------------*/
var ResourceCenter = function(options) {
	// rules:
	//	- '/' header additional
	//	- '//' header replace by systemName
	//	- '${name}' supported
	function basePathParser(ctx, path) {
		path = (path.charAt(0) != '/') ? '/' + path
			: path.replace(/^\/\//, '/' + ctx.system + '/');
		return path.replace(/\$\{([^\}]+)\}/g, function($0, $1) { return ctx[$1] || $0 })
	}

	function OPT(key) {
		return options && options[key] || default_config[key]
	}

	// http request
	this.request = require('request');
	this.request_headers = OPT('headers');

	// subscribe or notify address
	var parseContext = {
		system: this.systemName = OPT('systemName'),
		token: OPT('token')
	}
	this.clientVersion = OPT('clientVersion');
	this.notifyPath = basePathParser(parseContext, OPT('notifyPath'));
	this.queryPath = basePathParser(parseContext, OPT('queryPath'));
	this.subscribePath = basePathParser(parseContext, OPT('subscribePath'));
	this.groupBasePath = basePathParser(parseContext, OPT('groupBasePath'));

	// protocol interfaces
	var srvAddr = 'http://' + OPT('serverAddr');
	var cliAddr = 'http://' + OPT('clientAddr');
	this.rest_notify =  cliAddr + this.notifyPath;		// as receive url, register to server in internal_subscribe()
	this.rest_query = srvAddr + this.queryPath; 		// as REST api, call in internal_query()
	this.rest_subscribe = srvAddr + this.subscribePath;	// as REST api, call in internal_subscribe()

	// publish interfaces
	return {
		require: this.require.bind(this)
	}
}

ResourceCenter.prototype = {
	// interface by service
	query: function(key) {
		return internal_query(this, key)
	},

	// interface by service
	subscribe: function(key) {
		return internal_start_notify(this, key)
			.then(internal_subscribe.bind(null, this, key))
			// .then(log, err)
	},

	// interface for client, will convert <systemPart:pathPart> to key
	//	- for query/subscribe interface(s) of service
	require: function(parts) {
		return GLOBAL_CACHED_RESOURCES[parts]
			|| internal_require(this, parts)
	}
}

module.exports = ResourceCenter;