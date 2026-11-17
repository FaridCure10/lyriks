import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { RiCloseLine } from 'react-icons/ri';
import { HiOutlineMenu } from 'react-icons/hi';
import { logo } from '../assets';
import { links } from '../assets/constants';

const NavLinks = ({ handleClick }) => (
  <div className="mt-10">
    {links.map((link) => (
      <NavLink
        key={link.name}
        to={link.to}
        className="flex flex-row justify-start items-center my-8 text-sm font-medium text-gray-400 hover:text-cyan-400"
        onClick={() => handleClick && handleClick()}
      >
        <link.icon className="w-6 h-6 mr-2" aria-hidden="true" />
        {link.name}
      </NavLink>
    ))}
  </div>
);

const Sidebar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      <nav aria-label="Primary" className="md:flex hidden flex-col w-[240px] py-10 px-4 bg-[#191624]">
        <img src={logo} alt="Lyriks logo" className="w-full h-14 object-contain" />
        <NavLinks />
      </nav>

      <div className="absolute md:hidden block top-6 right-3 z-20">
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-drawer"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white rounded-lg cursor-pointer"
        >
          {mobileMenuOpen ? (
            <RiCloseLine className="w-6 h-6" aria-hidden="true" />
          ) : (
            <HiOutlineMenu className="w-6 h-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal={mobileMenuOpen ? 'true' : undefined}
        aria-label="Navigation drawer"
        aria-hidden={!mobileMenuOpen}
        className={`fixed top-0 h-dvh w-2/3 max-w-[300px] bg-gradient-to-tl from-white/10 to-[#483d8b]
        backdrop-blur-lg z-20 p-6 md:hidden smooth-transition ${mobileMenuOpen ? 'left-0' : '-left-full pointer-events-none'}`}
      >
        <nav aria-label="Mobile navigation">
          <img src={logo} alt="Lyriks logo" className="w-full h-14 object-contain" />
          <NavLinks handleClick={() => setMobileMenuOpen(false)} />
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
