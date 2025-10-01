'use client';

import React, { useRef, useEffect, useState } from "react";
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginButton } from '@/components/LoginButton';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getOAuthUrl } from '@/lib/api';
import AnimatedPathText from '@/components/fancy/text/text-along-path';
import ScrambleIn, { ScrambleInHandle } from '@/components/fancy/text/scramble-in';
import Float from '@/components/fancy/blocks/float';

// Component for cycling through different texts with scramble animation
function CyclingScrambleText({ texts, interval = 4000 }: { texts: string[], interval?: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrambleRef = useRef<ScrambleInHandle>(null);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % texts.length);
    }, interval);

    return () => clearInterval(cycleInterval);
  }, [texts.length, interval]);

  useEffect(() => {
    // Start scramble animation when text changes
    if (scrambleRef.current) {
      scrambleRef.current.start();
    }
  }, [currentIndex]);

  return (
    <ScrambleIn
      ref={scrambleRef}
      text={texts[currentIndex]}
      scrambleSpeed={25}
      scrambledLetterCount={5}
      autoStart={false}
    />
  );
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDashboardClick = () => {
    router.push('/dashboard');
  };

  const handleTryForFree = () => {
    // Redirect to backend OAuth flow
    window.location.href = getOAuthUrl();
  };

  const networkerTexts = [
    "crazy networkers",
    "internship searchers", 
    "relationship engineers",
    "people investors",
  ];

  const paths = [
    // Down, up all the way, then down, parabolic style:
    "M 20,0 Q 30,100 50,80 Q 70,60 95,90",
    "M 5,100 Q 30,30 50,50 Q 70,70 95,20",
  ];

  const texts = [
    `NETWORKING • CONNECTIONS • GROWTH • SUCCESS • OPPORTUNITIES • COLLABORATION • INNOVATION • LEADERSHIP • ON LINKEDIN • `,
    `LINKEDIN • EMAIL • OUTREACH • TRACKING • ANALYTICS • AUTOMATION • AI • PRODUCTIVITY • AUTOMATION • AI • PRODUCTIVITY`,
  ];

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-2">
      <header>
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-between items-center h-auto py-8">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="Linkmail Logo"
                className="h-8 w-8 mr-3"
                style={{ objectFit: "contain" }}
              />
              <h1 className="text-xl font-semibold text-primary">Linkmail</h1>
            </div>

            <div className="flex items-center">
              {user ? (
                <button
                  onClick={handleDashboardClick}
                  className="bg-primary cursor-pointer text-background px-6 py-1.5 rounded-lg text-base transition-colors ml-3 font-medium"
                >
                  Dashboard
                </button>
              ) : (
                <button
                  onClick={handleTryForFree}
                  className="bg-primary cursor-pointer text-background px-6 py-1.5 rounded-lg text-base transition-colors ml-3 font-medium"
                >
                  Try for Free
                </button>
              )}

            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl min-h-[calc(100vh-12rem)] flex">
        {/* Left Panel - Callout */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          <div className="max-w-lg text-center">
            <h1 className="text-5xl font-newsreader-500 font-bold text-primary mb-6 leading-tight">
              Made for the <br></br> <CyclingScrambleText texts={networkerTexts} />.
            </h1>
            <p className="text-lg text-secondary mb-12 leading-relaxed">
              The AI for people searching, email finding, <br></br>and outreach tracking
            </p>
            <div className="flex justify-center">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
              ) : user ? (
                <button
                  onClick={handleDashboardClick}
                  className="bg-primary cursor-pointer text-background px-4 py-1.5 rounded-lg text-sm transition-colors font-medium"
                >
                  Dashboard
                </button>
              ) : (
                <LoginButton expanded={true} />
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Blue Square */}
        <div 
          className="w-1/2 bg-[#1E67B5] flex items-center justify-center rounded-xl relative overflow-hidden"
          ref={containerRef}
        >
          {/* Hands image */}
          <div className="text-white text-center z-10 scale-105">
            <Float amplitude={[5, 10, 5]} rotationRange={[5, 5, 0]} speed={0.5}>
              <img
                src="/hands.png"
                alt="Hands illustration"
                className="mx-auto w-full h-auto object-contain"
              />
            </Float>
          </div>

          {/* Curved text overlay */}
          <div className="absolute w-full h-full flex flex-col">
            {paths.map((path, i) => (
              <AnimatedPathText
                key={`auto-path-${i}`}
                path={path}
                pathId={`auto-path-${i}`}
                svgClassName={`absolute -left-[100px] top-0 w-[calc(100%+200px)] h-full`}
                viewBox="0 0 100 100"
                text={texts[i] || ''}
                textClassName={`text-primary text-[2px] font-bold fill-black/35`}
                animationType="auto"
                duration={i * 0.5 + 8}
                textAnchor="start"
              />
            ))}
          </div>
          
        </div>
      </main>
    </div>
  );
}
