/* eslint-disable react/prop-types */
import { useState } from "react";
import { Blurhash } from "react-blurhash";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Tooltip from "@mui/material/Tooltip";
import ArchiveDrawerFillIcon from "remixicon-react/ArchiveDrawerFillIcon";
import "../../css/items/item-stat-component.css";
import "../../css/statCard.css";

function ItemStatComponent(props) {
  const [loaded, setLoaded] = useState(false);

  const handleImageLoad = () => {
    setLoaded(true);
  };

  const backgroundImage = `/proxy/Items/Images/Backdrop?id=${props.data[0].Id}&fillWidth=300&quality=10`;

  const cardStyle = {
    backgroundImage: `url(${backgroundImage}), linear-gradient(to right, #00A4DC, #AA5CC3)`,
    height: "100%",
    backgroundSize: "cover",
  };

  const cardBgStyle = {
    backdropFilter: props.base_url ? "blur(5px)" : "blur(0px)",
    backgroundColor: "rgb(0, 0, 0, 0.6)",
    height: "100%",
  };

  if (props.data.length === 0) {
    return <></>;
  }

  const renderItemName = (item) => {
    if (item.UserId) {
      return (
        <Link to={`/users/${item.UserId}`} className="item-name">
          <Tooltip title={item.Name}>
            <span className="item-text">{item.Name}</span>
          </Tooltip>
        </Link>
      );
    }

    if (!item.Client && !props.icon) {
      return (
        <Link to={`/libraries/item/${item.Id}`} className="item-name">
          <Tooltip title={item.Name}>
            <span className="item-text">{item.Name}</span>
          </Tooltip>
        </Link>
      );
    }

    if (!item.Client && props.icon) {
      return item.Id ? (
        <Link to={`/libraries/${item.Id}`} className="item-name">
          <Tooltip title={item.Name}>
            <span className="item-text">{item.Name}</span>
          </Tooltip>
        </Link>
      ) : (
        <Tooltip title={item.Name}>
          <span className="item-text">{item.Name}</span>
        </Tooltip>
      );
    }

    return (
      <Tooltip title={item.Client}>
        <span className="item-text">{item.Client}</span>
      </Tooltip>
    );
  };

  return (
    <Card className="stat-card rounded-2" style={cardStyle}>
      <div style={cardBgStyle} className="stat-card-overlay">
        <div className="stat-card-media">
          {props.icon ? (
            <div className="stat-card-icon">{props.icon}</div>
          ) : (
            <>
              {!props.data[0].archived && props.data[0].PrimaryImageHash && !loaded && (
                <Blurhash hash={props.data[0].PrimaryImageHash} height={"100%"} width={"100%"} className="stat-card-blurhash" />
              )}
              {!props.data[0].archived ? (
                <Card.Img
                  className={props.isAudio ? "stat-card-image-audio" : "stat-card-image"}
                  src={"proxy/Items/Images/Primary?id=" + props.data[0].Id + "&fillWidth=220&quality=82"}
                  style={{ display: loaded ? "block" : "none" }}
                  onLoad={handleImageLoad}
                  onError={() => setLoaded(false)}
                />
              ) : (
                <div className="stat-card-archived">
                  <ArchiveDrawerFillIcon />
                  <span>Archived</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="stat-card-details">
          <header className="stat-card-header">
            <span>{props.heading}</span>
            <small>{props.units}</small>
          </header>

          <div className="stat-card-list">
            {props.data.slice(0, 5).map((item, index) => (
              <div className="stat-items" key={item.Id || index}>
                <span className="stat-item-index">{index + 1}</span>
                {renderItemName(item)}
                <strong className="stat-item-count">{item.Plays || item.unique_viewers || item.Count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ItemStatComponent;
