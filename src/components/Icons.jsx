const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

const paths = {
  groom: (
    <>
      <path d="M12 10.5 4.5 6.8v8.4L12 11.5" />
      <path d="M12 10.5l7.5-3.7v8.4L12 11.5" />
      <rect x="10.6" y="9.4" width="2.8" height="3.2" rx="0.8" />
    </>
  ),
  bride: (
    <>
      <circle cx="12" cy="6.2" r="2.2" />
      <circle cx="8.6" cy="8.4" r="2" />
      <circle cx="15.4" cy="8.4" r="2" />
      <circle cx="12" cy="10.4" r="1.6" />
      <path d="M12 12v8.5M10 13.4l2 2.2 2-2.2M9.5 20.5h5" />
    </>
  ),
  rings: (
    <>
      <circle cx="9" cy="14.5" r="5" />
      <circle cx="15" cy="14.5" r="5" />
      <path d="M7.5 6.5 9 4.5h3l1.5 2-3 2.5z" />
    </>
  ),
  cheers: (
    <>
      <path d="M5.2 4.5h5l-.6 5a2 2 0 0 1-3.8 0z" transform="rotate(-12 7.7 8)" />
      <path d="M13.8 4.5h5l-.6 5a2 2 0 0 1-3.8 0z" transform="rotate(12 16.3 8)" />
      <path d="M8 12.2 7 19.5M16 12.2l1 7.3M5 19.8h4M15 19.8h4" />
      <path d="M12 2.2v1.6M10.2 3l.6.9M13.8 3l-.6.9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 13.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 15.3l2-.3z" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  musicOff: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
      <path d="M3 3l18 18" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  sms: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="2.2" />
    </>
  ),
  viber: (
    <>
      <path d="M12 2.8c4.9 0 8.4 2.1 8.4 7.6 0 5.2-3.2 7.5-8 7.5-.7 0-1.4 0-2-.1L7.6 20.6v-3.4C4.9 16 3.6 13.7 3.6 10.4c0-5.5 3.5-7.6 8.4-7.6z" />
      <path d="M9.3 7.4c.4-.3.9-.2 1.1.2l.7 1.3c.2.4.1.8-.2 1.1l-.4.3c.4 1 1.2 1.8 2.2 2.3l.3-.4c.3-.3.8-.4 1.1-.2l1.3.7c.4.2.5.7.2 1.1-.6.8-1.5 1.1-2.4.7-2-.9-3.5-2.4-4.4-4.4-.4-.9-.1-1.8.5-2.7z" />
      <path d="M12.8 6.2a3.4 3.4 0 0 1 3 3M12.9 4.4a5.2 5.2 0 0 1 4.8 4.8" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.2-3.9A8.3 8.3 0 1 1 8.4 19z" />
      <path d="M9.2 8.2c.3-.3.8-.3 1 .1l.6 1.3c.1.3 0 .6-.2.9l-.4.4c.5 1 1.3 1.8 2.3 2.3l.4-.4c.3-.2.6-.3.9-.2l1.3.6c.4.2.4.7.1 1-.7.7-1.6.9-2.5.5a7 7 0 0 1-3.7-3.7c-.4-.9-.2-1.8.2-2.8z" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  google: (
    <>
      <path d="M20 12.2c0 4.6-3.3 7.8-8 7.8a8 8 0 1 1 5.4-13.9" />
      <path d="M12.2 12h7.8" />
    </>
  ),
  apple: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M11 13.5h2M14 13.5h2M8 16.5h2M11 16.5h2" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  car: (
    <>
      <path d="M3.5 15.5v-2.2c0-.8.5-1.4 1.2-1.6l2.1-.6 2.2-3.1c.4-.6 1-.9 1.7-.9h3.4c.7 0 1.3.3 1.7.8l2.4 3.2 1.6.5c.8.2 1.2.9 1.2 1.6v2.3" />
      <path d="M3.5 15.5h1.6M9.4 15.5h5.2M18.9 15.5h1.6M7 11.1h10.6" />
      <circle cx="7.2" cy="15.8" r="1.9" />
      <circle cx="16.8" cy="15.8" r="1.9" />
    </>
  ),
  navigate: <path d="M20 4 4 11l6.5 2.5L13 20z" />,
}

export default function Icon({ name, size = 24, className = '' }) {
  return (
    <svg {...base} width={size} height={size} className={`icon ${className}`}>
      {paths[name]}
    </svg>
  )
}
