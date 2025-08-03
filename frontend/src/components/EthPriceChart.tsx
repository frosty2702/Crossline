'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PriceData {
  time: string
  price: number
}

interface EthPriceChartProps {
  priceHistory: PriceData[]
  currentPrice: number
}

export default function EthPriceChart({ priceHistory, currentPrice }: EthPriceChartProps) {
  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">ETH Price</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">${currentPrice.toLocaleString()}</div>
          <div className="text-sm text-gray-400">USD</div>
        </div>
      </div>
      
      {priceHistory.length > 1 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => value.slice(0, 5)} // Show only HH:MM
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-600 rounded w-32 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-24 mx-auto"></div>
            </div>
            <p className="text-gray-400 mt-4">Collecting price data...</p>
          </div>
        </div>
      )}
    </div>
  )
} 