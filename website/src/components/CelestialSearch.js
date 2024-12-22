import React, { useState } from 'react';
import axios from 'axios';

const CelestialSearch = () => {
  const [objectName, setObjectName] = useState('');
  const [visibility, setVisibility] = useState('');
  const [showCapture, setShowCapture] = useState(false);

  const handleSearch = async () => {
    try {
      // Sending the object name to the Python backend to check visibility
      const response = await axios.post('http://localhost:5000/check-visibility', { name: objectName });
      setVisibility(response.data.visibility);

      if (response.data.visibility === 'Visible') {
        setShowCapture(true); // Show live camera feed if visible
      }
    } catch (error) {
      console.error("Error checking visibility:", error);
    }
  };

  return (
    <div className="search-container">
      <input
        type="text"
        value={objectName}
        onChange={(e) => setObjectName(e.target.value)}
        placeholder="Enter celestial object name or coordinates"
      />
      <button onClick={handleSearch}>Check Visibility</button>
      
      {visibility && <div className="visibility-feedback">{visibility}</div>}
      
      {showCapture && (
        <div className="real-time-capture">
          <video autoPlay></video>
          {/* Add real-time capture from camera here */}
        </div>
      )}
    </div>
  );
};

export default CelestialSearch;
