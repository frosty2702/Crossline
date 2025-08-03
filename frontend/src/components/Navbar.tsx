'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-black/20 backdrop-blur-lg border-b border-white/70">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/crossline-logo.svg" alt="Crossline" className="w-8 h-8" />
            <span className="text-xl font-bold text-white">Crossline</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className={`font-medium transition-colors ${
                isActive('/') 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/trading" 
              className={`font-medium transition-colors ${
                isActive('/trading') 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Trading
            </Link>
            <Link 
              href="/crosschain" 
              className={`font-medium transition-colors ${
                isActive('/crosschain') 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Cross-Chain
            </Link>
            <Link 
              href="/orders" 
              className={`font-medium transition-colors ${
                isActive('/orders') 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Orders
            </Link>
            <Link 
              href="/history" 
              className={`font-medium transition-colors ${
                isActive('/history') 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              History
            </Link>
          </div>

          {/* Connect Button and Mobile Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              <ConnectButton />
            </div>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/70 py-4">
            <div className="flex flex-col space-y-4">
              <Link 
                href="/trading" 
                className={`font-medium transition-colors px-2 ${
                  isActive('/trading') 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Trading
              </Link>
              <Link 
                href="/crosschain" 
                className={`font-medium transition-colors px-2 ${
                  isActive('/crosschain') 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Cross-Chain
              </Link>
              <Link 
                href="/orders" 
                className={`font-medium transition-colors px-2 ${
                  isActive('/orders') 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Orders
              </Link>
              <Link 
                href="/history" 
                className={`font-medium transition-colors px-2 ${
                  isActive('/history') 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                History
              </Link>
              <div className="px-2">
                <ConnectButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
} 