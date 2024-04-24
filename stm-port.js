module.exports = function(RED) {
    function STM_PORT(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function(msg) {

            var ffi = require('ffi-napi');
            var ref = require('ref-napi');
            var int32 = ref.types.int32;

            // stmdsrce.dll must be in PATH
            var libstmapi = ffi.Library('stmdsrce.dll', {
                _AttachDataSource: ['bool', []],
                _DetachDataSource: [ref.types.void, []],
                _GetPortHandle: ['int32', ['int32']],
                _SetPortOn: ['bool', ['int32']],
                _SetPortOff: ['bool', ['int32']]
            });

            var attached = libstmapi._AttachDataSource();
            if (attached) {
                var port = config.port - 1;
                var p = libstmapi._GetPortHandle(port);

                if (p == -1) {
                    node.error("STM-PORT: Port not found");
                } else {
                    var cmd = (config.cmd == 'ON' ? 1 : 0);

                    if (cmd == 1) {
                        var bResOn = libstmapi._SetPortOn(p);
                        if (!bResOn) {
                            node.error("STM-PORT: SetPortOn returned FALSE");
                        }
                    } else {
                        var bResOff = libstmapi._SetPortOff(p);
                        if (!bResOff) {
                            node.error("STM-PORT: SetPortOff returned FALSE");
                        }
                    }
                }
                node.send(msg);
                libstmapi._DetachDataSource();
            } else {
                node.error("STM-PORT: Not attached to data source");
            }
        });
    }

    RED.nodes.registerType("stm-port", STM_PORT);
};
