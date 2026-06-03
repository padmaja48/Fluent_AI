import React from 'react';

const hairPaths = {
  short: (skinTone, hairColor) => (
    <>
      <ellipse cx="100" cy="65" rx="65" ry="50" fill={hairColor} />
      <ellipse cx="100" cy="80" rx="60" ry="55" fill={skinTone} />
      <rect x="35" y="55" width="130" height="40" fill={hairColor} rx="20" />
    </>
  ),
  long: (skinTone, hairColor) => (
    <>
      <ellipse cx="100" cy="60" rx="65" ry="50" fill={hairColor} />
      <ellipse cx="100" cy="78" rx="60" ry="56" fill={skinTone} />
      <rect x="35" y="100" width="18" height="110" fill={hairColor} rx="9" />
      <rect x="147" y="100" width="18" height="110" fill={hairColor} rx="9" />
    </>
  ),
  medium: (skinTone, hairColor) => (
    <>
      <ellipse cx="100" cy="62" rx="65" ry="50" fill={hairColor} />
      <ellipse cx="100" cy="79" rx="60" ry="55" fill={skinTone} />
      <rect x="35" y="100" width="18" height="60" fill={hairColor} rx="9" />
      <rect x="147" y="100" width="18" height="60" fill={hairColor} rx="9" />
    </>
  ),
};

export default function AvatarFace({ persona, isSpeaking, audioLevel = 0 }) {
  if (!persona) return null;
  const { skinTone, hairColor, hairStyle } = persona;
  const mouthRy = isSpeaking ? Math.max(3, audioLevel * 14 + 3) : 3;

  return (
    <svg
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className="avatar-svg"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Shoulders / jacket */}
      <ellipse cx="100" cy="228" rx="80" ry="38" fill="#1e2235" />

      {/* Hair (behind face) */}
      {(hairPaths[hairStyle] ?? hairPaths.medium)(skinTone, hairColor)}

      {/* Neck */}
      <rect x="84" y="168" width="32" height="32" fill={skinTone} rx="4" />

      {/* Face */}
      <ellipse cx="100" cy="120" rx="63" ry="72" fill={skinTone} />

      {/* Eyebrows */}
      <path d="M65 98 Q72 93 82 97" stroke={hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M118 97 Q128 93 135 98" stroke={hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Left eye */}
      <g className="eye-group left-eye" transform="translate(74,112)">
        <ellipse rx="13" ry="10" fill="white" />
        <circle r="6" fill="#2c1810" />
        <circle r="3" fill="#111" />
        <circle r="1.5" cx="2" cy="-2" fill="white" />
        <rect
          className="eyelid left-eyelid"
          x="-13"
          y="-10"
          width="26"
          height="22"
          fill={skinTone}
          style={{ transformOrigin: 'center top' }}
        />
      </g>

      {/* Right eye */}
      <g className="eye-group right-eye" transform="translate(126,112)">
        <ellipse rx="13" ry="10" fill="white" />
        <circle r="6" fill="#2c1810" />
        <circle r="3" fill="#111" />
        <circle r="1.5" cx="2" cy="-2" fill="white" />
        <rect
          className="eyelid right-eyelid"
          x="-13"
          y="-10"
          width="26"
          height="22"
          fill={skinTone}
          style={{ transformOrigin: 'center top' }}
        />
      </g>

      {/* Nose */}
      <path d="M97 128 Q100 138 103 128" stroke={hairColor} strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M94 140 Q100 143 106 140" stroke={hairColor} strokeWidth="1.5" fill="none" opacity="0.4" />

      {/* Mouth */}
      <ellipse cx="100" cy="158" rx="18" ry={mouthRy} fill="#c0665a" />
      {isSpeaking && mouthRy > 6 && (
        <ellipse cx="100" cy="158" rx="14" ry={mouthRy - 3} fill="#7b2d26" />
      )}
      {/* Smile crease */}
      <path
        d="M82 154 Q100 162 118 154"
        stroke={skinTone === '#F5CBA7' ? '#d4956a' : '#9e6b33'}
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
