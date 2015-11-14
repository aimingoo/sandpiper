// -------------------------------------------------------------------------------------------------------
// init at local, upgrade me as publisher node of n4c cluster
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// assign right of publisher node
//
// NOTE: The <taskDef> is real/pure distribution task!
// -------------------------------------------------------------------------------------------------------
var taskDef = {
	distributed: function() {
		console.log('NOTE: distributed() called by remote distributioin only.')
	},
	promised: function(opt) { // taskResult as options
		var TaskCenter = require('./infra/TaskCenter.js');
		return {
			task_register_center: new TaskCenter(opt)
		}
	}
}
module.exports = taskDef;