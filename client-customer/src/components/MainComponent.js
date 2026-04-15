import React from 'react';
import MenuComponent from './MenuComponent';
import HomeComponent from './HomeComponent';
import InformComponent from './InformComponent';

function MainComponent() {
  return (
    <div>
      <MenuComponent />
      <HomeComponent />
      <InformComponent />
    </div>
  );
}

export default MainComponent;