export interface OrderTypeDisplayInfo {
    orderType: 'dine_in' | 'take_away' | 'unknown';
    orderTypeLabel: string | null;
    orderLabel: string;
    tableLabel: string;
    tableValue: string | null;
    displayValue: string | null;
}

var TAKE_AWAY_MARKERS = [
    'TA',
    'TAKEAWAY',
    'TAKE AWAY',
    'TAKE_AWAY',
    'TANPA MEJA',
    'NO TABLE'
];

var normalizeLabel = function(value, fallback) {
    if (typeof value !== 'string') return fallback;
    var trimmed = value.trim();
    return trimmed || fallback;
};

export function getOrderTypeSettings(settings) {
    var orderCategoriesEnabled = true;
    if (settings) {
        if (settings.enable_order_type_categories === false || settings.enableOrderTypeCategories === false) {
            orderCategoriesEnabled = false;
        }
    }

    var dLabel = 'Dine In';
    if (settings) {
        if (settings.order_type_dine_in_label) dLabel = settings.order_type_dine_in_label;
        else if (settings.orderTypeDineInLabel) dLabel = settings.orderTypeDineInLabel;
    }

    var tLabel = 'Take Away';
    if (settings) {
        if (settings.order_type_take_away_label) tLabel = settings.order_type_take_away_label;
        else if (settings.orderTypeTakeAwayLabel) tLabel = settings.orderTypeTakeAwayLabel;
    }

    return {
        orderCategoriesEnabled: orderCategoriesEnabled,
        dineInLabel: normalizeLabel(dLabel, 'Dine In'),
        takeAwayLabel: normalizeLabel(tLabel, 'Take Away')
    };
}

export function resolveOrderTypeDisplay(tableRef, settings) {
    var s = getOrderTypeSettings(settings);
    var orderCategoriesEnabled = s.orderCategoriesEnabled;
    var dineInLabel = s.dineInLabel;
    var takeAwayLabel = s.takeAwayLabel;

    var rawValue = typeof tableRef === 'string' ? tableRef.trim() : '';
    var normalizedValue = rawValue
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    if (!rawValue || rawValue === '-') {
        return {
            orderType: 'unknown',
            orderTypeLabel: null,
            orderLabel: 'Order',
            tableLabel: 'Meja',
            tableValue: null,
            displayValue: null
        };
    }

    var isTakeAway = false;
    for (var i = 0; i < TAKE_AWAY_MARKERS.length; i++) {
        if (TAKE_AWAY_MARKERS[i] === normalizedValue) {
            isTakeAway = true;
            break;
        }
    }

    if (!orderCategoriesEnabled) {
        return {
            orderType: isTakeAway ? 'take_away' : 'dine_in',
            orderTypeLabel: null,
            orderLabel: 'Order',
            tableLabel: 'Meja',
            tableValue: rawValue,
            displayValue: rawValue
        };
    }

    if (isTakeAway) {
        return {
            orderType: 'take_away',
            orderTypeLabel: takeAwayLabel,
            orderLabel: 'Order',
            tableLabel: 'Meja',
            tableValue: null,
            displayValue: takeAwayLabel
        };
    }

    return {
        orderType: 'dine_in',
        orderTypeLabel: dineInLabel,
        orderLabel: 'Order',
        tableLabel: 'Meja',
        tableValue: rawValue,
        displayValue: rawValue
    };
}
