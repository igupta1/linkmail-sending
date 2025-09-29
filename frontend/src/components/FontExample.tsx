import React from 'react';

export default function FontExample() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-4xl font-ginto font-bold">Ginto Font Family</h1>
      <h2 className="text-2xl font-ginto-nord font-medium">Ginto Nord Font Family</h2>
      
      <div className="space-y-2">
        <p className="font-ginto font-thin text-lg">Thin (100) - Ginto</p>
        <p className="font-ginto font-light text-lg">Light (300) - Ginto</p>
        <p className="font-ginto font-normal text-lg">Regular (400) - Ginto</p>
        <p className="font-ginto font-medium text-lg">Medium (500) - Ginto</p>
        <p className="font-ginto font-bold text-lg">Bold (700) - Ginto</p>
        <p className="font-ginto font-black text-lg">Black (900) - Ginto</p>
      </div>
      
      <div className="space-y-2">
        <p className="font-ginto-nord font-thin text-lg">Thin (100) - Ginto Nord</p>
        <p className="font-ginto-nord font-hairline text-lg">Hairline (200) - Ginto Nord</p>
        <p className="font-ginto-nord font-light text-lg">Light (300) - Ginto Nord</p>
        <p className="font-ginto-nord font-normal text-lg">Regular (400) - Ginto Nord</p>
        <p className="font-ginto-nord font-medium text-lg">Medium (500) - Ginto Nord</p>
        <p className="font-ginto-nord font-bold text-lg">Bold (700) - Ginto Nord</p>
        <p className="font-ginto-nord font-extrabold text-lg">Extra Bold (800) - Ginto Nord</p>
        <p className="font-ginto-nord font-black text-lg">Black (900) - Ginto Nord</p>
      </div>
      
      <div className="space-y-2">
        <p className="font-ginto italic text-lg">Italic - Ginto</p>
        <p className="font-ginto-nord italic text-lg">Italic - Ginto Nord</p>
      </div>
    </div>
  );
}
