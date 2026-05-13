/**
 * Returns an ISO string with the local timezone offset (e.g. +07:00 for WIB)
 */
export var getLocalISOString = function() {
    var now = new Date();
    var tzOffset = -now.getTimezoneOffset();
    var sign = tzOffset >= 0 ? '+' : '-';
    
    var pad = function(n) {
        var s = String(Math.floor(Math.abs(n)));
        while (s.length < 2) {
            s = '0' + s;
        }
        return s;
    };
    
    var hours = pad(tzOffset / 60);
    var minutes = pad(tzOffset % 60);
    
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    
    return local.toISOString().slice(0, 19) + sign + hours + ":" + minutes;
};

/**
 * Returns just the local date in YYYY-MM-DD format
 */
export var getLocalDateString = function() {
    var iso = getLocalISOString();
    return iso.split('T')[0];
};
