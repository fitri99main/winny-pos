/**
 * Returns an ISO string with the local timezone offset (e.g. +07:00 for WIB)
 * Standard Date.toISOString() returns UTC which causes transactions made before 07:00 WIB
 * to be recorded as the previous day.
 */
export const getLocalISOString = () => {
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset(); // offset in minutes
    const sign = tzOffset >= 0 ? '+' : '-';
    const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
    const hours = pad(tzOffset / 60);
    const minutes = pad(tzOffset % 60);
    
    // Create a new date object shifted by the offset so toISOString() 
    // gives us the local year, month, day, hour, min, sec
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    
    // Format: YYYY-MM-DDTHH:mm:ss+HH:MM
    return local.toISOString().slice(0, 19) + `${sign}${hours}:${minutes}`;
};

/**
 * Returns just the local date in YYYY-MM-DD format
 */
export const getLocalDateString = () => {
    return getLocalISOString().split('T')[0];
};
