import { QRCodeSVG } from 'qrcode.react';
import { User, CreditCard, Calendar, ShieldCheck } from 'lucide-react';

interface QRCardProps {
    type: 'Customer' | 'Employee';
    name: string;
    id: string;
    roleOrTier?: string;
    joinDateOrBirthday?: string;
}

export function QRCard({ type, name, id, roleOrTier, joinDateOrBirthday }: QRCardProps) {
    const isEmployee = type === 'Employee';

    return (
        <div className="id-card-container print:m-0 print:p-0">
            <div className={`relative w-[350px] h-[210px] rounded-2xl shadow-2xl overflow-hidden flex transition-all duration-300 ${isEmployee
                    ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border-2 border-indigo-400/30'
                    : 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-2 border-amber-300/30'
                }`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-8 -mb-8 blur-xl" />

                {/* Left Side: Photo/Icon & Data */}
                <div className="flex-1 p-6 flex flex-col justify-between relative z-10 text-white">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${isEmployee ? 'bg-white/20' : 'bg-black/10'
                            }`}>
                            {isEmployee ? <ShieldCheck className="w-7 h-7" /> : <CreditCard className="w-7 h-7" />}
                        </div>
                        <div>
                            <h3 className="font-black text-lg leading-tight tracking-tight uppercase">
                                {isEmployee ? 'Employee ID' : 'Member Card'}
                            </h3>
                            <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">
                                Winny Cafe & Resto
                            </p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h2 className="text-xl font-black truncate drop-shadow-md">{name}</h2>
                        <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 opacity-90">
                                <User className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase">{roleOrTier || (isEmployee ? 'STAFF' : 'REGULAR')}</span>
                            </div>
                            {joinDateOrBirthday && (
                                <div className="flex items-center gap-1.5 opacity-70">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[9px] font-medium">{joinDateOrBirthday}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-[9px] mt-4 font-mono opacity-50">
                        VALID SINCE: 2024 • SYSTEM ID: {id}
                    </div>
                </div>

                {/* Right Side: QR Code Area */}
                <div className="w-[120px] bg-white flex flex-col items-center justify-center p-3 gap-2 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />
                    <div className="relative group">
                        <QRCodeSVG
                            value={id}
                            size={100}
                            level="H"
                            includeMargin={false}
                            className="relative z-10"
                        />
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary/40 rounded-tl-sm" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary/40 rounded-br-sm" />
                    </div>
                    <span className="text-[8px] font-black text-gray-400 tracking-widest uppercase">Scan for Access</span>
                </div>
            </div>

            <style>{`
        @media print {
          body * { visibility: hidden; }
          .id-card-container, .id-card-container * { visibility: visible; }
          .id-card-container {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          .id-card-container > div {
             box-shadow: none !important;
             print-color-adjust: exact;
             -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
        </div>
    );
}
