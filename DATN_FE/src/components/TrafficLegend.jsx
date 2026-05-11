import { speedLevelData } from '../utils/traffic';
import './TrafficLegend.css';

function TrafficLegend() {
  return (
    <div className="traffic-legend">
      <div className="legend-title">
        <h4>Phân loại tốc độ</h4>
      </div>
      <div className="legend-items">
        {speedLevelData.map((item) => (
          <div key={item.level} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <div className="legend-text">
              <span className="level-name">{item.level}</span>
              <span className="level-speed">{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrafficLegend;
