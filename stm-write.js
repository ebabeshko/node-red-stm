module.exports = function (RED) {

    function STM_WRITE(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function (msg) {

            let attached = false;
            let libstmapi;

            try {

                const ffi = require('ffi-napi');
                const ref = require('ref-napi');

                libstmapi = ffi.Library(
                    'stmdsrce.dll',
                    {
                        _AttachDataSource: ['bool', []],
                        _DetachDataSource: [ref.types.void, []],
                        _SetDataBlockEx: [
                            'int32',
                            ['int32', 'int32', 'int32', 'pointer', 'pointer', 'pointer', 'int32']
                        ]
                    }
                );

                attached = libstmapi._AttachDataSource();

                if (!attached) {
                    node.error("STM-WRITE: Not attached to data source", msg);
                    return;
                }

                var kpn = msg.payload.hasOwnProperty('kp') ? msg.payload.kp : config.kp;
                var bn = msg.payload.hasOwnProperty('bn') ? msg.payload.bn : config.bn;

                var btime = Buffer.alloc(6);

                var buf;
                var temp;

                if (msg.payload.hasOwnProperty('value')) {

                    buf = Buffer.alloc(4);
                    buf.writeInt32LE(msg.payload.value);
                    temp = buf;

                } else if (msg.payload.hasOwnProperty('NewLimit')) {

                    buf = Buffer.alloc(4);
                    buf.writeInt32LE(msg.payload.NewLimit);
                    temp = buf;

                } else {

                    temp = config.val.split(",");

                    buf = Buffer.alloc(temp.length * 4);

                    for (let i = 0; i < temp.length; i++) {
                        buf.writeInt32LE(parseInt(temp[i], 10), i * 4);
                    }
                }

                var num = Buffer.from([1]);

                var dt = new Date();

                btime.writeUInt32LE(Math.round(dt / 1000), 0);
                btime.writeUInt16LE(Math.round(dt % 1000), 4);

                var iRes = libstmapi._SetDataBlockEx(
                    kpn,
                    bn,
                    0,
                    btime,
                    buf,
                    num,
                    4
                );

                switch (iRes) {

                    case 1:
                        node.error("STM: SetDataBlockEx returned 1 (DATASRC_ERROR)");
                        break;

                    case 2:
                        node.error("STM: SetDataBlockEx returned 2 (DATASRC_DEV_ERROR)");
                        break;

                    case 3:
                        node.error("STM: SetDataBlockEx returned 3 (DATASRC_BLOCK_ERROR)");
                        break;

                    case 4:
                        node.error("STM: SetDataBlockEx returned 4 (DATASRC_TYPE_ERROR)");
                        break;

                    case 5:
                        node.error("STM: SetDataBlockEx returned 5 (OUTBUF_ERROR)");
                        break;
                }
                node.send(msg);

            } catch (err) {

                node.error("STM-WRITE Exception: " + err.message, msg);

            } finally {

                if (attached && libstmapi) {
                    libstmapi._DetachDataSource();
                }

            }

        });

    }

    RED.nodes.registerType("stm-write", STM_WRITE);
};