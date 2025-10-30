import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

export const UploadIcon = (props: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

export const CheckCircleIcon = (props: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.06-1.06l-3.25 3.25-1.5-1.5a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.75-3.75Z" clipRule="evenodd" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

export const LogoIcon = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.97 2.122L7.5 21h9l-1.528-1.621a3 3 0 0 1-.97-2.122v-1.007M15 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

export const BugIcon = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-3.5-3.5M16.5 12h-9m9 0-2.25-4.5M7.5 12l-2.25 4.5M12 16.5V21" />
    </svg>
);

export const LightningBoltIcon = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
);

export const WandIcon = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.475 2.118A2.25 2.25 0 0 0 1 18c0 1.518 1.02 2.75 2.25 2.75h9A2.25 2.25 0 0 0 14.5 18c0-.986-.534-1.834-1.328-2.222a3 3 0 0 0-5.78-1.128 2.25 2.25 0 0 1-2.475-2.118 2.25 2.25 0 0 0-2.25-2.25H1.5V9h1.5a2.25 2.25 0 0 0 2.25-2.25 2.25 2.25 0 0 1 2.118-2.475 3 3 0 0 0 1.128-5.78 2.25 2.25 0 0 0 2.222-1.328c.39-.794 1.234-1.328 2.222-1.328s1.832.534 2.222 1.328a2.25 2.25 0 0 0 2.222 1.328 3 3 0 0 0 5.78 1.128 2.25 2.25 0 0 1 2.475 2.118 2.25 2.25 0 0 0 2.25 2.25h1.5v1.5h-1.5a2.25 2.25 0 0 0-2.25 2.25 2.25 2.25 0 0 1-2.118 2.475 3 3 0 0 0-1.128 5.78 2.25 2.25 0 0 0-1.328 2.222c-.39.794-1.234 1.328-2.222 1.328s-1.832-.534-2.222-1.328a2.25 2.25 0 0 0-1.328-2.222Z" />
    </svg>
);

export const LayersIcon = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19A9 9 0 1 0 18.81 5.19m-12.695 0a9 9 0 0 0 12.695 0m-12.695 0v.005a9 9 0 0 1 12.695 0v-.005" />
    </svg>
);