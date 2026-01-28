import { Skeleton } from "../ui/skeleton"

export function DashboardSkeleton() {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans relative">
            {/* Sidebar Skeleton */}
            <aside className="w-56 bg-white/70 dark:bg-gray-900/70 border-r border-white/20 dark:border-gray-800 flex flex-col py-8 z-20">
                <div className="mb-10 px-6 flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>

                <div className="px-3 space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <Skeleton className="w-9 h-9 rounded-xl" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Skeleton */}
            <main className="flex-1 overflow-auto relative z-10 p-8">
                {/* Header Skeleton */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-32 h-10 rounded-xl" />
                        <Skeleton className="w-10 h-10 rounded-full" />
                    </div>
                </div>

                {/* Dashboard Widgets Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <Skeleton className="w-16 h-6 rounded-full" />
                            </div>
                            <Skeleton className="h-8 w-24 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    ))}
                </div>

                {/* Chart/Table Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 h-96">
                        <Skeleton className="h-full w-full rounded-xl" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 h-96">
                        <Skeleton className="h-full w-full rounded-xl" />
                    </div>
                </div>
            </main>
        </div>
    )
}
