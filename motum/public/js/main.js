var socket = io();
var _state = {
    poll_timer: 0,
    jog: {
        timer: null,
        count: 0,
        speed: 100, // ms
        step: 1,
        axis: null,
        direction: 0,
        modes: [[0,20,40],[1, 10, 100]] //[[counts],[speeds]]
    },
    devices: {
        pos_mode: 'absolute',
        tinyg:{
            connection: 0,
            all_animate: false,
            x_pos: 0,
            x_min: 0,
            x_max: 1,
            x_limit: false,
            x_animate: false,
            x_moving: false,
            y_pos: 0,
            y_min: 0,
            y_max: 1,
            y_limit: false,
            y_animate: false,
            y_moving: false,
            z_pos: 0,
            z_min: 0,
            z_max: 1,
            z_limit: false,
            z_animate: false,
            z_moving: false,
            a_pos: 0,
            a_min: 0,
            a_max: 1,
            a_limit: false,
            a_animate: false,
            a_moving: false
        },
        mindflex:{
            port: null,
            connection: 200,
            attention: 0,
            meditation: 0
        }
    }
};



/* server communication */
var recieveUpdate = function (data){
    data = JSON.parse(data);
    // transfer data to local structure
    _state.devices.tinyg = data.tinyg;
    _state.devices.mindflex = data.mindflex;
    // update UI
    refreshUI();
};

var requestUpdate = function() {
    socket.emit('request_update', "{}");
};

var jogControlRequest = function () {
    console.log("requesting jog: " + _state.jog.axis + "+=" + (_state.jog.direction * _state.jog.step));
    var command = JSON.stringify({command:"tinyg_position", data:{axis: _state.jog.axis, offset: (_state.jog.direction * _state.jog.step)}});
    socket.emit('manual_update', command);
}


socket.on('update', function(data){
    recieveUpdate(data);
});

/* UI */
var getPercent = function (val, max){
    val = val/max * 100;
    return val.toFixed(2) + '%';
};

var formatPositionDisplay = function (val, max){
    if (_state.devices.pos_mode == 'absolute'){
        return val;
    } else {
        if (max != 0){
            return getPercent(val, max);
        } else {
            return '';
        }
    }
}

var refreshUI = function (){
  // tinyg
    // position display
    $('#tinyg #x-axis .pos input:text').val(formatPositionDisplay(_state.devices.tinyg.x_pos, _state.devices.tinyg.x_max));
    $('#tinyg #y-axis .pos input:text').val(formatPositionDisplay(_state.devices.tinyg.y_pos, _state.devices.tinyg.y_max));
    $('#tinyg #z-axis .pos input:text').val(formatPositionDisplay(_state.devices.tinyg.z_pos, _state.devices.tinyg.z_max));
    $('#tinyg #a-axis .pos input:text').val(formatPositionDisplay(_state.devices.tinyg.a_pos, _state.devices.tinyg.a_max));
    $('#tinyg #x-axis .decrement').prop('disabled', _state.devices.tinyg.x_pos == 0 ? 'disabled' : '');
    $('#tinyg #y-axis .decrement').prop('disabled', _state.devices.tinyg.y_pos == 0 ? 'disabled' : '');
    $('#tinyg #z-axis .decrement').prop('disabled', _state.devices.tinyg.z_pos == 0 ? 'disabled' : '');
    $('#tinyg #a-axis .decrement').prop('disabled', _state.devices.tinyg.a_pos == 0 ? 'disabled' : '');
    // perecentage bars
    $('#tinyg #x-axis .mercury').css('width', getPercent(_state.devices.tinyg.x_pos, _state.devices.tinyg.x_max));
    $('#tinyg #y-axis .mercury').css('width', getPercent(_state.devices.tinyg.y_pos, _state.devices.tinyg.y_max));
    $('#tinyg #z-axis .mercury').css('width', getPercent(_state.devices.tinyg.z_pos, _state.devices.tinyg.z_max));
    $('#tinyg #a-axis .mercury').css('width', getPercent(_state.devices.tinyg.a_pos, _state.devices.tinyg.a_max));
    $('#tinyg #x-axis .scale').html(_state.devices.tinyg.x_max);
    $('#tinyg #y-axis .scale').html(_state.devices.tinyg.y_max);
    $('#tinyg #z-axis .scale').html(_state.devices.tinyg.z_max);
    $('#tinyg #a-axis .scale').html(_state.devices.tinyg.a_max);

    // mindflex
    $('#mindflex #connection input').val(_state.devices.mindflex.connection);
    $('#mindflex #attention input').val(_state.devices.mindflex.attention);
}

var handleEStop = function () {
    socket.emit('manual_update', '{"command": "STOP"}')
};

var resetJogControl = function (){
    // stop everything
    _state.jog.axis = null;
    _state.jog.count = 0;
    _state.jog.step = 0;
    _state.jog.direction = 0;
    clearTimeout(_state.jog.timer);
}
var startJogTimer  = function (){
    _state.jog.timer = setInterval(handleJogControl, _state.jog.speed);
}
var handleJogControl = function (axis, direction){
    // console.log('handleJogControl(' + axis + ', ' + direction + ')');
    // this can be called from either direct button click or as a callback from a timer
    // if no args then add them from saved
    if (typeof axis == 'undefined'){
        axis = _state.jog.axis;
    }
    if (typeof direction == 'undefined'){
        direction = _state.jog.direction;
    }
    if (direction == 0){
        resetJogControl();
        // console.log("cancelling jog");
        // don't renew timer
        return;
    }
    if (axis == _state.jog.axis && direction == _state.jog.direction){
        // continue current
        _state.jog.count ++;
        // determine and set the current speed
        for (var i = 0; i < _state.jog.modes[0].length; i++){
            if (_state.jog.count > _state.jog.modes[0][i]){
                _state.jog.step = _state.jog.modes[1][i];
            }
        }
    } else {
        // reset and start new
        resetJogControl();
        // make the updates
        _state.jog.axis = axis;
        _state.jog.count ++;
        _state.jog.direction = direction;
        // start the timer
        startJogTimer (axis, direction);
    }
    jogControlRequest();
};

var handleZeroControl = function (axis) {
    console.log("requesting axis zeroing: " + axis);
    var command = JSON.stringify({command:"tinyg_zero", data:{axis: axis}});
    socket.emit('manual_update', command);
};

var handleMaxControl = function (axis, type) {
    switch(type){
        case 'go':
            // we want the machine to travel to its extents
            console.log("requesting axis go to max: " + axis);
            var command = JSON.stringify({command:"tinyg_max", data:{axis: axis}});
            socket.emit('manual_update', command);
            break;
        case 'rec':
            // we want to record the current position as the new max value
            console.log("requesting record axis max: " + axis);
            var command = JSON.stringify({command:"tinyg_record_max", data:{axis: axis}});
            socket.emit('manual_update', command);
            break;
    }
};
var handleAnimateControl = function (this_control) {
    var axis = this_control.closest('tr').attr('id').split('-')[0];
    if (axis == 'all'){
        // set all animate controls to the value of this one
        $('.animate input').each(function (index) {
            if ($(this).closest('tr').attr('id').split('-')[0] != axis){
                $(this).prop('checked', this_control.prop('checked'));
                $(this).prop('disabled', this_control.prop('checked') ? 'disabled' : '');
            }
        });
    }
    var command = JSON.stringify({command:"tinyg_animate", data:{axis: axis, value: this_control.prop('checked')}});
    socket.emit('manual_update', command);
};

/* Init */
$(document).ready(function(){
    // e-stop
    $('.stop').on('click', function () {
        handleEStop();
    });
    // position display mode change
    $("input:radio[name='pos-mode']").on('click', function (){
        _state.devices.pos_mode = $("input:radio[name='pos-mode']:checked").val();
    });
    // jogging
    $('.decrement').on('mousedown', function (){
        var axis = $(this).closest('tr').attr('id').split('-')[0];
        handleJogControl(axis, -1);
    });
    $('.increment').on('mousedown', function (){
        var axis = $(this).closest('tr').attr('id').split('-')[0];
        handleJogControl(axis, 1);
    });
    $('.decrement').on('mouseup', function (){
        handleJogControl('all', 0);
    })
    $('.increment').on('mouseup', function (){
        handleJogControl('all', 0);
    })
    // cancel all jogging
    $(document).on('mouseup', function (){
        handleJogControl('all', 0);
    })
    // zero buttons
    $('.zero input').on('click', function (){
        var axis = $(this).closest('tr').attr('id').split('-')[0];
        handleZeroControl(axis);
    });
    // max buttons
    $('.max input.go').on('click', function (){
        var axis = $(this).closest('tr').attr('id').split('-')[0];
        handleMaxControl(axis, 'go');
    });
    $('.max input.rec').on('click', function (){
        var axis = $(this).closest('tr').attr('id').split('-')[0];
        handleMaxControl(axis, 'rec');
    });
    // animate buttons
    $('.animate input').on('click', function (){
        handleAnimateControl($(this));
    });

    //
    _state.poll_timer = setInterval(requestUpdate, 10); // 10 ms, change as needed
});