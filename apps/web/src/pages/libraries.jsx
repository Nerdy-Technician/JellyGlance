import { useCallback, useEffect, useState } from "react";
import axios from "../lib/axios_instance";
import Config from "../lib/config";

import "./css/library/libraries.css";
import Loading from "./components/general/loading";
import LibraryCard from "./components/library/library-card";
import ErrorBoundary from "./components/general/ErrorBoundary";
import EyeOffFillIcon from "remixicon-react/EyeOffFillIcon";
import EyeFillIcon from "remixicon-react/EyeFillIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
import { Tooltip } from "react-bootstrap";
import { Trans } from "react-i18next";
import i18next from "i18next";

function Libraries() {
  const [data, setData] = useState();
  const [metadata, setMetaData] = useState();
  const [config, setConfig] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [scanningLibraryId, setScanningLibraryId] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);

  const fetchLibraries = useCallback(() => {
    if (config) {
      const url = `/stats/getLibraryCardStats`;
      axios
        .get(url, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
        })
        .then((data) => {
          setData(data.data);
        })
        .catch((error) => {
          console.log(error);
        });

      const metadataurl = `/stats/getLibraryMetadata`;

      axios
        .get(metadataurl, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
        })
        .then((data) => {
          setMetaData(data.data);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }, [config]);

  async function scanLibrary(library) {
    if (!config || scanningLibraryId) {
      return;
    }

    try {
      setScanMessage(null);
      setScanningLibraryId(library.Id);
      await axios.post(
        `/sync/library/${library.Id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setScanMessage({ type: "success", text: `${library.Name} scan complete.` });
      fetchLibraries();
    } catch (error) {
      setScanMessage({ type: "error", text: error.response?.data?.message || error.response?.data?.error || `Unable to scan ${library.Name}.` });
    } finally {
      setScanningLibraryId(null);
    }
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.getConfig();
        setConfig(newConfig);
      } catch (error) {
        if (error.code === "ERR_NETWORK") {
          console.log(error);
        }
      }
    };

    if (!config) {
      fetchConfig();
    }

    fetchLibraries();
    const intervalId = setInterval(fetchLibraries, 60000 * 60);
    return () => clearInterval(intervalId);
  }, [config, fetchLibraries]);

  if (!data || !metadata) {
    return <Loading />;
  }

  const visibleLibraries = data
    .filter((library) => library.archived === false || library.archived === showArchived)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const totalItems = visibleLibraries.reduce((total, library) => total + (library.Library_Count || 0), 0);
  const totalPlays = visibleLibraries.reduce((total, library) => total + (library.Plays || 0), 0);
  const archivedCount = data.filter((library) => library.archived === true).length;

  return (
    <div className="libraries">
      <div className="libraries-header">
        <div>
          <p className="libraries-eyebrow">Media stack</p>
          <h1>
            <Trans i18nKey="LIBRARIES" />
          </h1>
          <div className="libraries-summary">
            <span>{visibleLibraries.length} libraries</span>
            <span>{totalItems.toLocaleString()} items</span>
            <span>{totalPlays.toLocaleString()} plays</span>
          </div>
        </div>
        {data.filter((library) => library.archived === true).length > 0 &&
          (showArchived ? (
            <Tooltip title={i18next.t("HIDE_ARCHIVED_LIBRARIES")} className="tooltip-icon-button">
              <button className="libraries-archive-button" onClick={() => setShowArchived(!showArchived)}>
                <EyeFillIcon />
                <span>Hide archived</span>
              </button>
            </Tooltip>
          ) : (
            <Tooltip title={i18next.t("SHOW_ARCHIVED_LIBRARIES")} className="tooltip-icon-button">
              <button className="libraries-archive-button" onClick={() => setShowArchived(!showArchived)}>
                <EyeOffFillIcon />
                <span>Show archived ({archivedCount})</span>
              </button>
            </Tooltip>
          ))}
      </div>

      {scanMessage ? <div className={`libraries-scan-message is-${scanMessage.type}`}>{scanMessage.text}</div> : null}

      <div className="libraries-container">
        {visibleLibraries.map((item) => (
          <ErrorBoundary key={item.Id}>
            <LibraryCard
              data={item}
              metadata={metadata.find((data) => data.Id === item.Id)}
              base_url={config.settings?.EXTERNAL_URL ?? config.hostUrl}
              onScan={() => scanLibrary(item)}
              scanning={scanningLibraryId === item.Id}
              scanDisabled={Boolean(scanningLibraryId)}
              scanIcon={<RefreshLineIcon size={17} />}
            />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}

export default Libraries;
