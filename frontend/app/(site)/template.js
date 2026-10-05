// Next remounts template.js on every navigation, giving each page a soft
// fade-in. Pure CSS on purpose: a JS (framer-motion) fade renders the server
// HTML at opacity 0, so the page stayed blank until JavaScript loaded.
export default function Template({ children }) {
  return <div className="animate-page-in">{children}</div>;
}
