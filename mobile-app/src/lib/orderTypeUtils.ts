export interface OrderTypeDisplayInfo {
    orderType: 'dine_in' | 'take_away' | 'unknown';
    orderTypeLabel: string | null;
    orderLabel: string;
    tableLabel: string;
    tableValue: string | null;
    displayValue: string | null;
}

const TAKE_AWAY_MARKERS = new Set([
    'TA',
    'TAKEAWAY',
    'TAKE AWAY',
    'TAKE_AWAY',
    'TANPA MEJA',
    'NO TABLE'
]);

const normalizeLabel = (value: unknown, fallback: string) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

export function getOrderTypeSettings(settings?: any) {
    return {
        orderCategoriesEnabled: settings?.enable_order_type_categories !== false
            && settings?.enableOrderTypeCategories !== false,
        dineInLabel: normalizeLabel(
            settings?.order_type_dine_in_label ?? settings?.orderTypeDineInLabel,
            'Dine In'
        ),
        takeAwayLabel: normalizeLabel(
            settings?.order_type_take_away_label ?? settings?.orderTypeTakeAwayLabel,
            'Take Away'
        )
    };
}

export function resolveOrderTypeDisplay(tableRef?: string | null, settings?: any): OrderTypeDisplayInfo {
    const { orderCategoriesEnabled, dineInLabel, takeAwayLabel } = getOrderTypeSettings(settings);
    const rawValue = typeof tableRef === 'string' ? tableRef.trim() : '';
    const normalizedValue = rawValue
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

    const isTakeAway = TAKE_AWAY_MARKERS.has(normalizedValue);

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
