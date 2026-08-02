module.exports = function (RED) {

    function STM(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function (msg) {

            var ffi = require('ffi-napi');
            var ref = require('ref-napi');
            const ArrayType = require('ref-array-di')(ref);

            var int32 = ref.types.int32;
            var uint32 = ref.types.uint32;
            var float32 = ref.types.float;

            var Int32Array = ArrayType(int32);
            var Uint32Array = ArrayType(uint32);
            var Float32Array = ArrayType(float32);

            // stmdsrce.dll must be in PATH
            var libstmapi = ffi.Library('stmdsrce.dll', {
                _AttachDataSource: ['bool', []],
                _DetachDataSource: [ref.types.void, []],
                _GetSysNo: ['uint16', []],
                _GetDataBlockEx: ['int32', ['int32', 'int32', 'int32', 'pointer', 'pointer', 'pointer', 'pointer', 'pointer']],
                _IsDataBlockValid: ['bool', ['int32', 'int32']]
            });

            var attached = libstmapi._AttachDataSource();

            if (!attached) {
                node.error("STM: Not attached to data source");
                return;
            }

            try {

                var kpn = config.kp;
                var bn = config.bn;
                var btype = (config.btype === 'TS' ? 1 : 0);

                var time = Buffer.from(new Uint32Array(1));
                var btime = Buffer.from(new Uint8Array(6));
                var buf = Buffer.from(new Uint32Array(5000));
                var num = Buffer.from([5000]);
                var type = Buffer.from(new Uint8Array(1));

                var iRes = libstmapi._GetDataBlockEx(
                    kpn,
                    bn,
                    btype,
                    time,
                    btime,
                    buf,
                    num,
                    type
                );

                switch (iRes) {
                    case 1:
                        node.error("STM: GetDataBlockEx returned 1 (DATASRC_ERROR)");
                        break;
                    case 2:
                        node.error("STM: GetDataBlockEx returned 2 (DATASRC_DEV_ERROR)");
                        break;
                    case 3:
                        node.error("STM: GetDataBlockEx returned 3 (DATASRC_BLOCK_ERROR)");
                        break;
                    case 4:
                        node.error("STM: GetDataBlockEx returned 4 (DATASRC_TYPE_ERROR)");
                        break;
                    case 5:
                        node.error("STM: GetDataBlockEx returned 5 (OUTBUF_ERROR)");
                        break;
                }

                if (iRes === 0 && num[0] > 0) {

                    var datablock;

                    switch (type[0]) {
                        case 0: // BVAL
                        case 2: // WVAL
                        case 5: // DWVAL
                            datablock = new Uint32Array(buf);
                            break;

                        case 1: // SHVAL
                        case 4: // IVAL
                            datablock = new Int32Array(buf);
                            break;

                        case 3: // FVAL
                            datablock = new Float32Array(buf);
                            break;

                        default:
                            node.error("STM: Unknown data type");
                            return;
                    }

                    var retArray = [];

                    for (var i = 0; i < num[0]; i++) {
                        retArray.push(datablock[i]);
                    }

                    // Main payload
                    msg.payload = retArray;

                    // Optional: System Number
                    if (msg.hasOwnProperty('sysno')) {
                        msg.sysno = libstmapi._GetSysNo();
                    }

                    // Optional: Block Validity
                    if (msg.hasOwnProperty('valid')) {
                        msg.valid = libstmapi._IsDataBlockValid(kpn, bn);

                        if (msg.valid) {
                            node.send(msg);
                        } else {
                            node.send(null);
                        }
                    } else {
                        node.send(msg);
                    }
                }
            } catch (err) {

                node.error("STM Exception: " + err.message, msg);
           
            } finally {
                libstmapi._DetachDataSource();
            }

        });
    }

    RED.nodes.registerType("stm", STM);
};