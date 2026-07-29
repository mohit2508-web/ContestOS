export default function Test() {
  const title = 'Browser Lockdown';
  const isActive = true;

  return (
    <div>
      <h3 className={`text-base font-bold mb-2 ${isActive ? 'text-white' : 'text-gray-600'}`}>{title}</h3>
    </div>
  );
}