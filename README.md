#sandpiper
sandpiper is implement of N4C architecture in NodeJS.

about N4C architecture  @see [n4c project](https://github.com/aimingoo/n4c).

#install
install and start etcd service first(example in macosx):
```bash
> brew install etcd
> etcd
```
and install sandpiper by npm+nodejs
> npm install sandpiper

#run as resource service/center
> npm start

#import and usage
> @see $(sandpiper)/sandpiper.js

```javascript
var pedt = require('sandpiper');
pedt.run(...)
```
the sandpiper run at n4c unlimited+dispatcher node.

#testcase
try these:
```bash
> # start etcd fist

> # run sandpiper as resource service
> npm start

> # run sandpiper base test
> npm test

> # run full testcase
> node testcase/t_tasks.js
[INFO] done.
hi
the worker node upgrade as dispatcher.
{ x: 'ok' }
the worker node unlimited.
the worker node initialized.
[INFO] distribution scope: "sandpiper:/com.wandoujia.n4c/sandpiper/nodes:*"
[INFO] distribution taskId: "task:c2eb2597e461aa3aa0e472f52e92fe0b"
[INFO] daemon arguments: { a: 3, b: 4 }
[INFO] arguments for loacalTask:  { p1: 'new value' }
{ run_task: { p1: 'value from remote', info: 'HELLO' } }
[INFO] arguments for loacalTask:  { p1: 'new value' }
[INFO] arguments for loacalTask:  { p1: 'new value' }
[INFO] recude result: [ { a: '1', b: '2', p1: 'new value', info: 'HELLO' } ]
true
[ { x: '100', y: '200', info: 'HELLO', p1: 'default value' } ]
```
# run testcase of interfaces
and then, try next:
```bash
> bash testcase/t_interfaces.sh
===============================================================
:: registed items in init_worker_node.js
/com.wandoujia.n4c/sandpiper/nodes/groupOwner
/com.wandoujia.n4c/sandpiper/nodes/127.0.0.1:8032
/com.wandoujia.n4c/sandpiper/nodes/.127.0.0.1:8032
:: registed nodes
/com.wandoujia.n4c/sandpiper/nodes/.127.0.0.1:8032
:: execute_task interfaces
http://127.0.0.1:8032/sandpiper/execute_
:: heartbeat in init_worker_node.js
1447493107586
:: execute_task in init_unlimit_node.js
{"info":"HELLO","p1":"default value"}
:: resource query in init_resource_center.js
["http://127.0.0.1:8032/sandpiper/execute_"]
:: resource subscribe in init_resource_center.js
["http://127.0.0.1:8032/sandpiper/execute_"]
:: resource subscribe at instance 2
["http://127.0.0.1:8032/sandpiper/execute_"]
===============================================================
Done.
```

# history
```text
2015.11.14	v1.0.0 released.
```