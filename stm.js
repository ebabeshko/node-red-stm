module.exports = function(RED) {
        function STM(config) {           
            RED.nodes.createNode(this,config);
            var node = this;
            node.on('input', function(msg) {

	var ffi = require('ffi-napi')
	var ref = require('ref-napi')
	const ArrayType = require('ref-array-di')(ref);

	var int32 = ref.types.int32
	var uint32 = ref.types.uint32
	var float32 = ref.types.float
	
	var Int32Array = ArrayType(int32);	
	var Uint32Array = ArrayType(uint32);
	var Float32Array = ArrayType(float32);	

	// stmdsrce.dll must be in PATH
	var libstmapi = ffi.Library('stmdsrce.dll', {
        _AttachDataSource: ['bool', []],
        _DetachDataSource: [ref.types.void, []],
		_GetSysNo: ['uint16', []],		
        _GetDataBlockEx: ['int32', ['int32', 'int32' , 'int32', 'pointer', 'pointer', 'pointer', 'pointer', 'pointer']],
	    _IsDataBlockValid: ['bool', ['int32', 'int32']]
    });

	var attached = libstmapi._AttachDataSource();
	if (attached) {
		var kpn = config.kp;
		var bn = config.b;	
		var btype = (config.btype == 'TS'?1:0);
		var time = Buffer.from(new Uint32Array(1));
		var btime = Buffer.from(new Uint8Array(6));
		var buf = Buffer.from(new Uint32Array(5000));
		var num =  Buffer.from([5000]);
		var type = Buffer.from(new Uint8Array(1));
	
		var iRes = libstmapi._GetDataBlockEx(kpn, bn, btype, time, btime, buf, num, type);

		switch (iRes) {
		case 1:
			node.error("STM: GetDataBlockEx returned 1 (DATASRC_ERROR)");
			break
		case 2:
			node.error("STM: GetDataBlockEx returned 2 (DATASRC_DEV_ERROR)");
			break
		case 3:
			node.error("STM: GetDataBlockEx returned 3 (DATASRC_BLOCK_ERROR)");
			break
		case 4:
			node.error("STM: GetDataBlockEx returned 4 (DATASRC_TYPE_ERROR)");
			break									
		case 5:
			node.error("STM: GetDataBlockEx returned 5 (OUTBUF_ERROR)");
			break						
		}

		if (iRes == 0 && num[0] > 0) {
			var datablock;
			switch (type[0]) {
				case 0: // BVAL					
					var datablock = new Uint32Array(buf);
					break			
				case 1: // SHVAL
					var datablock = new Int32Array(buf);
					break			
				case 2:	// WVAL
					var datablock = new Uint32Array(buf);
					break			
				case 3: // FVAL
					var datablock = new Float32Array(buf);
					break
				case 4: // IVAL
					var datablock = new Int32Array(buf);
					break				
				case 5: // DWVAL
					var datablock = new Uint32Array(buf);
					break	
			}

			var retArray = []

			for(var i = 0; i < num[0]; i++){
				retArray.push(datablock[i]) 
		 	}

			// Main payload: Block
		 	msg.payload = retArray

			// Optional property: System Number
			if(msg.hasOwnProperty('sysno')){
				var sysno = libstmapi._GetSysNo();				
				msg.sysno = sysno;
			 }

			 // Optional property: Block Validity
			 if(msg.hasOwnProperty('valid')){
				var valid = libstmapi._IsDataBlockValid(kpn, bn);
				msg.valid = valid;
			 }
		 	node.send(msg);		 
		}		

		libstmapi._DetachDataSource();
	}
	else
	{
	    node.error("STM: Not attached to data source");
	}                
            });
        }

        RED.nodes.registerType("stm",STM);
    }