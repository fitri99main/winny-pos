# Troubleshooting: Payment Modal Tidak Muncul

## Kemungkinan Penyebab

### 1. **Mengakses via Web Browser** ❌
Log menunjukkan: `[web] Logs will appear in the browser console`

**Masalah**: PaymentModal dibuat untuk React Native (mobile), tidak kompatibel dengan web.

**Solusi**: Akses via:
- Android Emulator
- iOS Simulator  
- Physical device (scan QR code)

### 2. **Belum Reload di Device**
Expo restart di terminal ≠ reload di device

**Solusi**:
- Shake device → "Reload"
- Atau tutup app → buka lagi

### 3. **Ada Error di Console**
Mungkin ada error yang tidak terlihat

**Cara Cek**:
```bash
# Di terminal Expo, tekan 'j' untuk buka debugger
# Atau lihat error di device
```

## Langkah Troubleshooting

### Step 1: Pastikan Akses via Mobile
```bash
# Di terminal Expo:
# - Tekan 'a' untuk Android emulator
# - Tekan 'i' untuk iOS simulator
# - Scan QR code dengan Expo Go app di physical device
```

### Step 2: Cek Error
Di device, shake → "Show Dev Menu" → "Debug Remote JS"

### Step 3: Test Sederhana
Tambahkan console.log untuk debug:

```typescript
const handleCheckout = () => {
    console.log('Checkout clicked!', cart.length);
    if (cart.length === 0) {
        Alert.alert('Keranjang Kosong');
        return;
    }
    console.log('Opening payment modal...');
    setPaymentModalOpen(true);
};
```

### Step 4: Verifikasi Import
Pastikan PaymentModal ter-import:
```typescript
import PaymentModal from '../components/PaymentModal'; // ✅
```

## Quick Test

1. Buka mobile app (BUKAN web)
2. Tambah 1 produk ke cart
3. Klik "Bayar"
4. Lihat apakah modal muncul

Jika masih tidak muncul, share:
- Platform yang digunakan (Android/iOS/Web)
- Error message (jika ada)
- Screenshot
