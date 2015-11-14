// -------------------------------------------------------------------------------------------------------
// init at local, upgrade me as unlimited node of n4c cluster
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// assign right of unlimited node
// -------------------------------------------------------------------------------------------------------
var log = console.log.bind(console);
var err = function(e) { console.log(e.stack||e) };
var PEDT_infra = require('redpoll').infra;
var request_parse = PEDT_infra.requestdata.parse;

// The GET request schema:
//		- http://<node></path_from_routed_map>/execute_task:<MD5>?x=1&b=2
var local_config = {
	etcdServer: { host: '127.0.0.1', port:'4001' },
	nodeAddr: '127.0.0.1:8032',  // task accept addr:port, from init_worker_node.js
	systemName: 'sandpiper',
	groupBasePath: '/com.wandoujia.n4c/sandpiper/nodes',
	executePath: '//execute_'
}

var ERR_HTTP_HEADER = {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
var emitter = function(args) { this.emit.apply(this, args) }

var taskObject = {
	unlimited: { run: function(conf) {
		// create httpd, invoke '/sandpiper/execute_'
		var rx_execute_task = new RegExp('^'+conf.executePath), rx_len = conf.executePath.length;
		var url = require("url"), actions = conf.actions;
		var port = parseInt(conf.nodeAddr.split(':')[1] || '8032');
		require("http").createServer(function(request, response) {
			var urlObject = url.parse(request.url);
			if (! urlObject.pathname.match(rx_execute_task)) return actions.emit('error', 404);
			var taskId = urlObject.pathname.substr(rx_len),
				params = request_parse(request);
			// console.log('launch distributed task from remote:', request.url);
			Promise.all(["execute_task", request, response, taskId, params])
				.then(emitter.bind(actions)).catch(err);
		}).listen(port);

		// register "execute_task" interface in etcd
		var ignore = function(reason) { }
		var etcd = conf.etcdServer,
			dataKey = conf.groupBasePath + '/' + conf.nodeAddr + '/execute_task'; // @see <workerNodePath> in init_worker_node.js
			execute_task_uri = 'http://' + conf.nodeAddr + conf.executePath;
		etcd.set(dataKey, execute_task_uri, {}).catch(ignore);

		// invoke 'execute_task' event
		var submitTaskResult = function(taskResult) {
			this.write(JSON.stringify(taskResult));
			this.end();
		};
		var errorResp = function(reason) {
			this.writeHead(500, ERR_HTTP_HEADER);
			this.write(JSON.stringify({error: 500, reason: reason}));
			this.end()
		};
		var n4c = this;
		actions.on("execute_task", function(_, response, taskId, args) {
			n4c.execute_task(taskId, args).then(submitTaskResult.bind(response), errorResp.bind(response));
		});

		return true
	}},

	promised: function() {
		return "the worker node unlimited."
	}
}

var local_distributed = function(taskObject) {
	function basePathParser(base, path) {
		return (path.charAt(0) != '/') ? '/' + path
			: path.replace(/^\/\//, '/' + base + '/');
	}

	// about conf of EtcdPromise, @see: create arguments in "node-etcd" module
	var opt = local_config,
		conf = opt.etcdServer,
		EtcdPromise = require('node-etcd-promise');
	if (typeof(conf) == 'object') {
		conf = (conf instanceof String) ? { hosts: [conf] }
			: (conf instanceof Array) ?  { hosts: conf }
			: conf;
	}
	else if (typeof(conf) == 'string') {
		conf = { hosts: [conf] }
	}
	else throw new Error('etcdServer options invalid');

	var events = require('events');
	opt.executePath = basePathParser(opt.systemName, opt.executePath);
	opt.groupBasePath = basePathParser(opt.systemName, opt.groupBasePath);
	taskObject.unlimited.arguments = Object.create(opt, {
		etcdServer: { value: new EtcdPromise(conf.hosts, conf.sslopts, conf.client) },
		actions: { value: new events.EventEmitter() }
	});

	var e = taskObject.unlimited.arguments.actions;
	e.on("error", err);
}

local_distributed(taskObject);
module.exports = taskObject;