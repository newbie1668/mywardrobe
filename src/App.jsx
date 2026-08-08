import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash, X } from "@phosphor-icons/react";
import { WardrobeImportFlow } from "./import-flow.jsx";
import { OptimizedImage } from "./OptimizedImage.jsx";
import {
  createCompleteLook,
  getLookBuilder,
  getWearableCoreStatus,
  selectPairingOption,
  switchReferenceCombination,
} from "./pairing-data.js";

const STORAGE_KEY = "open-wardrobe-edits-v1";
const DELETED_STORAGE_KEY = "open-wardrobe-deleted-v1";

const TYPES = [
  { id: "all", label: "All" },
  { id: "upperbody", label: "Tops", singular: "Top" },
  { id: "wholebody_up", label: "Jackets", singular: "Jacket" },
  { id: "lowerbody", label: "Bottoms", singular: "Bottom" },
  { id: "accessories_up", label: "Accessories", singular: "Accessory" },
  { id: "shoes", label: "Shoes", singular: "Shoes" },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((type) => [type.id, type]));
const TYPE_ORDER = Object.fromEntries(TYPES.slice(1).map((type, index) => [type.id, index]));


function readEdits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}


function persistEdit(item) {
  const edits = readEdits();
  edits[item.id] = {
    name: item.name || "",
    part: item.part,
    color: item.color || null,
    secondaryColor: item.secondaryColor || null,
    tags: item.tags || [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
}

function removePersistedEdit(id) {
  const edits = readEdits();
  delete edits[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
}

function readDeletedItems() {
  try {
    const value = JSON.parse(localStorage.getItem(DELETED_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function persistDeletedItem(id) {
  const deleted = readDeletedItems();
  deleted.add(id);
  localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify([...deleted]));
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(first, second) {
  return Math.sqrt(
    ((first.red - second.red) ** 2)
    + ((first.green - second.green) ** 2)
    + ((first.blue - second.blue) ** 2),
  );
}

function extractPalette(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 72;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 72) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const key = `${Math.round(red / 28)}-${Math.round(green / 28)}-${Math.round(blue / 28)}`;
    const current = buckets.get(key) || { red: 0, green: 0, blue: 0, count: 0 };
    current.red += red;
    current.green += green;
    current.blue += blue;
    current.count += 1;
    buckets.set(key, current);
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      red: Math.round(bucket.red / bucket.count),
      green: Math.round(bucket.green / bucket.count),
      blue: Math.round(bucket.blue / bucket.count),
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);

  const selected = [];
  for (const color of ranked) {
    if (selected.every((existing) => colorDistance(existing, color) > 38)) selected.push(color);
    if (selected.length === 5) break;
  }

  return selected.map((color) => rgbToHex(color.red, color.green, color.blue));
}

function buildSamplingCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0);
  return canvas;
}

function sampleImageColor(image, canvas, event) {
  const bounds = image.getBoundingClientRect();
  const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  const imageX = Math.floor((event.clientX - bounds.left - offsetX) / scale);
  const imageY = Math.floor((event.clientY - bounds.top - offsetY) / scale);

  if (imageX < 0 || imageY < 0 || imageX >= canvas.width || imageY >= canvas.height) return null;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  for (let radius = 0; radius <= 18; radius += 2) {
    const startX = Math.max(0, imageX - radius);
    const startY = Math.max(0, imageY - radius);
    const width = Math.min(canvas.width - startX, (radius * 2) + 1);
    const height = Math.min(canvas.height - startY, (radius * 2) + 1);
    const data = context.getImageData(startX, startY, width, height).data;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 96) return rgbToHex(data[index], data[index + 1], data[index + 2]);
    }
  }

  return null;
}

function GalleryItem({ item, selected, onOpen }) {
  const type = TYPE_MAP[item.part]?.singular || "wardrobe item";

  return (
    <button
      className={`gallery-item${selected ? " selected" : ""}`}
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`View ${item.name || type}`}
      aria-pressed={selected}
      data-testid={`wardrobe-item-${item.id}`}
    >
      <OptimizedImage
        src={item.thumbnail || item.image}
        alt=""
        sizes="(max-width: 520px) calc(50vw - 16px), (max-width: 860px) calc(33vw - 18px), 180px"
        breakpoints={[120, 180, 240, 320, 480]}
      />
    </button>
  );
}

function OutfitCard({ outfit, selected, onOpen }) {
  const occasions = Array.isArray(outfit.occasion) ? outfit.occasion.join(" · ") : "wardrobe idea";

  return (
    <button
      className={`outfit-card${selected ? " selected" : ""}`}
      type="button"
      onClick={() => onOpen(outfit.id)}
      aria-label={`View ${outfit.name || "outfit idea"}`}
      aria-pressed={selected}
    >
      <span className="outfit-card-photo">
        <OptimizedImage
          src={outfit.image}
          alt=""
          sizes="(max-width: 520px) calc(50vw - 16px), (max-width: 860px) calc(50vw - 28px), 340px"
          breakpoints={[240, 320, 480, 640, 800]}
        />
      </span>
      <span className="outfit-card-details">
        <span className="outfit-card-heading">
          <strong>{outfit.name}</strong>
          <small>{occasions}</small>
        </span>
        <span className="outfit-card-reason">{outfit.reason}</span>
      </span>
    </button>
  );
}

function OutfitViewer({ outfit, items, onClose }) {
  const closeButtonRef = useRef(null);
  const itemNames = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("viewer-open");
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("viewer-open");
    };
  }, [onClose]);

  return (
    <div className="viewer-overlay outfit-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="viewer-entry outfit-viewer-entry">
        <aside className="outfit-viewer" role="dialog" aria-modal="true" aria-label={`${outfit.name} outfit idea`}>
          <button className="viewer-icon-close" type="button" onClick={onClose} aria-label="Close outfit viewer" ref={closeButtonRef}>
            <X size={24} weight="light" aria-hidden="true" />
          </button>
          <div className="outfit-viewer-photo">
            <OptimizedImage
              src={outfit.image}
              alt={`${outfit.name} modeled outfit`}
              sizes="(max-width: 860px) 100vw, 520px"
              breakpoints={[320, 480, 640, 800, 1040, 1280]}
              quality={84}
              priority
            />
          </div>
          <div className="outfit-viewer-details">
            <p className="outfit-viewer-eyebrow">Outfit idea</p>
            <h2>{outfit.name}</h2>
            {Array.isArray(outfit.occasion) && outfit.occasion.length > 0 && (
              <div className="outfit-occasion-list" aria-label="Occasions">
                {outfit.occasion.map((occasion) => <span key={occasion}>{occasion}</span>)}
              </div>
            )}
            <p className="outfit-viewer-reason">{outfit.reason}</p>
            <div className="outfit-piece-list">
              <p>Pieces</p>
              <ul>
                {outfit.garmentIds.map((garmentId) => <li key={garmentId}>{itemNames.get(garmentId) || garmentId}</li>)}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LookBuilderPanel({ item, items }) {
  const lookBuilder = useMemo(() => getLookBuilder(item, items), [item, items]);
  const defaultCombinationNumber = lookBuilder.candidates[0]?.combinationNumber || null;
  const [referenceCombinationNumber, setReferenceCombinationNumber] = useState(defaultCombinationNumber);
  const [completeLook, setCompleteLook] = useState(() => createCompleteLook(item, defaultCombinationNumber));
  const [expandedRoles, setExpandedRoles] = useState({});
  const [combinationChangeNotice, setCombinationChangeNotice] = useState(null);
  const referenceCombination = lookBuilder.candidates.find(({ combinationNumber }) => (
    combinationNumber === referenceCombinationNumber
  )) || lookBuilder.candidates[0] || null;
  const combinationGuide = referenceCombination?.combinationGuide || null;
  const wearableCoreStatus = useMemo(() => (
    getWearableCoreStatus(completeLook, referenceCombination)
  ), [completeLook, referenceCombination]);

  const applyReferenceTransition = (candidate, action = null) => {
    const transition = switchReferenceCombination(completeLook, candidate);
    const nextCombinationNumber = candidate?.combinationNumber || null;
    setReferenceCombinationNumber(nextCombinationNumber);
    setCompleteLook(transition.completeLook);
    if (action || transition.removedSelections.length) {
      setCombinationChangeNotice({
        heading: nextCombinationNumber
          ? `${action || "Updated"} Combination ${nextCombinationNumber}.`
          : "No Candidate Combination remains.",
        hasCandidate: Boolean(candidate),
        retainedCount: transition.retainedSelections.length,
        removedSelections: transition.removedSelections,
      });
    }
  };

  useEffect(() => {
    const initialLook = createCompleteLook(item, defaultCombinationNumber);
    const sameAnchor = completeLook.anchorPieceId === item.id && completeLook.anchorRole === initialLook.anchorRole;
    const activeCandidate = sameAnchor ? lookBuilder.candidates.find(({ combinationNumber }) => (
      combinationNumber === referenceCombinationNumber
    )) : null;
    const nextCandidate = activeCandidate || lookBuilder.candidates[0] || null;
    const nextCombinationNumber = nextCandidate?.combinationNumber || null;

    if (!sameAnchor) {
      setReferenceCombinationNumber(defaultCombinationNumber);
      setCompleteLook(initialLook);
      setExpandedRoles({});
      setCombinationChangeNotice(null);
      return;
    }

    if (!nextCandidate) {
      if (completeLook.referenceCombinationNumber !== null) {
        applyReferenceTransition(null, "No Candidate Combination remains");
      }
      return;
    }

    const combinationChanged = referenceCombinationNumber !== nextCombinationNumber;
    applyReferenceTransition(nextCandidate, combinationChanged ? "Switched to" : null);
  }, [item.id, item.part, lookBuilder, referenceCombinationNumber]);

  const choosePairingOption = (option) => {
    setCompleteLook((current) => selectPairingOption(current, option));
  };

  const chooseReferenceCombination = (candidate) => {
    if (candidate.combinationNumber === referenceCombination?.combinationNumber) return;
    applyReferenceTransition(candidate, "Switched to");
  };

  return (
    <section className="look-builder-panel" aria-labelledby="look-builder-title">
      <div className="look-builder-heading">
        <div>
          <p className="look-builder-eyebrow">Build from this piece</p>
          <h3 id="look-builder-title">Look Builder</h3>
        </div>
        <small>
          {lookBuilder.candidates.length} Candidate {lookBuilder.candidates.length === 1 ? "Combination" : "Combinations"}
        </small>
      </div>

      <div className="look-builder-anchor">
        <span className="look-builder-anchor-image">
          <OptimizedImage
            src={item.thumbnail || item.image}
            alt=""
            sizes="58px"
            breakpoints={[80, 120, 160]}
          />
        </span>
        <div className="look-builder-anchor-copy">
          <span>Anchor Piece</span>
          <strong>{item.name || TYPE_MAP[item.part]?.singular || "Wardrobe item"}</strong>
          {lookBuilder.anchorColour ? (
            <small>
              <span className="look-builder-anchor-swatch" style={{ backgroundColor: lookBuilder.anchorColour.garmentHex }} aria-hidden="true" />
              Primary Anchor Colour {lookBuilder.anchorColour.garmentHex} is closest to {lookBuilder.anchorColour.dictionaryColourName}
            </small>
          ) : (
            <small>No close Dictionary colour was found for the primary Anchor Colour.</small>
          )}
        </div>
      </div>

      {combinationChangeNotice && (
        <div className="combination-change-notice" role="status" aria-live="polite">
          <strong>{combinationChangeNotice.heading}</strong>
          {combinationChangeNotice.removedSelections.length ? (
            <>
              <ul>
                {combinationChangeNotice.removedSelections.map((selection) => (
                  <li key={`${selection.wardrobeRole}-${selection.pieceId}`}>{selection.reason}</li>
                ))}
              </ul>
              <p>No replacements were selected. {combinationChangeNotice.retainedCount
                ? `${combinationChangeNotice.retainedCount} compatible ${combinationChangeNotice.retainedCount === 1 ? "selection was" : "selections were"} kept.`
                : combinationChangeNotice.hasCandidate
                  ? "Choose new Pairing Options below."
                  : "Adjust the Anchor Colour or secondary colour to find a new Candidate Combination."}</p>
            </>
          ) : (
            <p>{combinationChangeNotice.retainedCount ? `Kept ${combinationChangeNotice.retainedCount} compatible ${combinationChangeNotice.retainedCount === 1 ? "selection" : "selections"}.` : "No garment selections needed to change."}</p>
          )}
        </div>
      )}

      {lookBuilder.candidates.length ? (
        <>
          <div className="candidate-combinations">
            <p>Candidate Combinations</p>
            <div className="candidate-combination-list" role="tablist" aria-label="Choose a Dictionary Combination">
              {lookBuilder.candidates.map((candidate) => {
                const isReference = candidate.combinationNumber === referenceCombination?.combinationNumber;
                return (
                  <button
                    key={candidate.combinationNumber}
                    type="button"
                    className={isReference ? "active" : ""}
                    role="tab"
                    aria-selected={isReference}
                    aria-controls={`combination-guide-${candidate.combinationNumber}`}
                    onClick={() => chooseReferenceCombination(candidate)}
                  >
                    <strong>{candidate.label}</strong>
                    <span className="candidate-combination-swatches" aria-hidden="true">
                      {candidate.combinationGuide.swatches.map((swatch) => (
                        <i key={`${candidate.combinationNumber}-${swatch.hex}`} style={{ backgroundColor: swatch.hex }} />
                      ))}
                    </span>
                    <small>
                      {candidate.coverage.swatchCount} {candidate.coverage.swatchCount === 1 ? "colour" : "colours"} covered
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          <article
            className="combination-guide"
            id={`combination-guide-${combinationGuide.combinationNumber}`}
            role="tabpanel"
            aria-live="polite"
          >
            <header>
              <p>Combination Guide</p>
              <h4>{combinationGuide.label}</h4>
            </header>

            <p className="combination-guide-mapping">
              <span className="combination-guide-anchor-swatch" style={{ backgroundColor: combinationGuide.anchorColour.garmentHex }} aria-hidden="true" />
              <span>
                The primary Anchor Colour <strong>{combinationGuide.anchorColour.garmentHex}</strong> is {combinationGuide.anchorColour.relationship} <strong>{combinationGuide.anchorColour.dictionaryColourName}</strong> ({combinationGuide.anchorColour.dictionaryHex}).
              </span>
            </p>

            <ul className="combination-guide-swatches" aria-label={`All colours in ${combinationGuide.label}`}>
              {combinationGuide.swatches.map((swatch) => (
                <li key={`${combinationGuide.combinationNumber}-${swatch.hex}`}>
                  <span style={{ backgroundColor: swatch.hex }} aria-hidden="true" />
                  <div>
                    <strong>{swatch.name}</strong>
                    <small>{swatch.hex}</small>
                  </div>
                </li>
              ))}
            </ul>

            <p className="combination-guide-attribution">Source: {combinationGuide.attribution}</p>
          </article>

          <section className="pairing-options" aria-labelledby="pairing-options-title">
            <div className="pairing-options-heading">
              <div>
                <p>Build a Wearable Core</p>
                <h4 id="pairing-options-title">Pairing Options</h4>
              </div>
              <small>Required roles first · one piece per role</small>
            </div>

            <div className="pairing-role-list">
              {referenceCombination.pairingOptionGroups.map((group) => {
                const isExpanded = Boolean(expandedRoles[group.wardrobeRole]);
                const displayedOptions = isExpanded ? group.allOptions : group.options;
                const optionListId = `pairing-options-${referenceCombination.combinationNumber}-${group.wardrobeRole}`;
                return (
                <section className="pairing-role" key={group.wardrobeRole} aria-labelledby={`pairing-role-${group.wardrobeRole}`}>
                  <header>
                    <div>
                      <h5 id={`pairing-role-${group.wardrobeRole}`}>{group.label}</h5>
                      {group.alternative === "clothing" && (
                        <small>Choose a top and bottom, or choose a one-piece garment.</small>
                      )}
                    </div>
                    <span className={group.requirement === "optional" ? "optional" : "required"}>
                      {group.requirement === "alternative" ? "Alternative" : group.requirement === "required" ? "Required" : "Optional"}
                    </span>
                  </header>

                  {group.options.length ? (
                    <>
                    <div className="pairing-option-list" id={optionListId}>
                      {displayedOptions.map((option) => {
                        const selected = completeLook.selectedByRole[option.wardrobeRole]?.pieceId === option.pieceId;
                        return (
                          <button
                            className={`pairing-option${selected ? " selected" : ""}`}
                            type="button"
                            key={option.pieceId}
                            aria-pressed={selected}
                            onClick={() => choosePairingOption(option)}
                          >
                            <span className="pairing-option-image">
                              <OptimizedImage
                                src={option.thumbnail || option.image}
                                alt=""
                                sizes="72px"
                                breakpoints={[80, 120, 160]}
                              />
                              {selected && <span className="pairing-option-check"><Check size={13} weight="bold" aria-hidden="true" /></span>}
                            </span>
                            <span className="pairing-option-copy">
                              <strong>{option.pieceName}</strong>
                              {option.mapping.kind === "dictionary" ? (
                                <small>
                                  <span className="pairing-option-swatches" aria-hidden="true">
                                    <i style={{ backgroundColor: option.mapping.garmentHex }} />
                                    <i style={{ backgroundColor: option.mapping.dictionaryHex }} />
                                  </span>
                                  {option.mapping.garmentHex} is {option.mapping.relationship} {option.mapping.dictionaryColourName} ({option.mapping.dictionaryHex}) in Combination {option.referenceCombinationNumber}.
                                </small>
                              ) : (
                                <small>
                                  <span className="pairing-option-neutral-swatch" style={{ backgroundColor: option.mapping.garmentHex }} aria-hidden="true" />
                                  {option.mapping.neutralName} · {option.mapping.label}
                                </small>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {group.hasMore && (
                      <button
                        className="pairing-see-all"
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={optionListId}
                        onClick={() => setExpandedRoles((current) => ({
                          ...current,
                          [group.wardrobeRole]: !isExpanded,
                        }))}
                      >
                        {isExpanded ? "Show first six" : `See all ${group.totalOptionCount} ${group.label.toLowerCase()} options`}
                      </button>
                    )}
                    </>
                  ) : (
                    <p className="pairing-role-empty">
                      {group.requirement === "alternative"
                        ? "No context-appropriate Pairing Options are available for this clothing path."
                        : "No context-appropriate Pairing Options are available for this required role."}
                    </p>
                  )}
                </section>
                );
              })}
            </div>

            <div className={`wearable-core-status${wearableCoreStatus.canSave ? " ready" : ""}`} role="status" aria-live="polite">
              <div>
                <strong>{wearableCoreStatus.label}</strong>
                {wearableCoreStatus.canSave ? (
                  <p>Your Wearable Core is complete and its selected pieces express {referenceCombination.label}.</p>
                ) : (
                  <ul>
                    {wearableCoreStatus.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                  </ul>
                )}
              </div>
              <span className={`look-save-readiness${wearableCoreStatus.canSave ? " ready" : ""}`}>
                {wearableCoreStatus.canSave && <Check size={15} weight="bold" aria-hidden="true" />}
                {wearableCoreStatus.canSave ? "Ready to save" : "Save unavailable"}
              </span>
            </div>
          </section>
        </>
      ) : (
        <p className="look-builder-empty">
          No Candidate Combinations are both close enough to this Anchor Colour and covered by wearable pieces in this wardrobe.
        </p>
      )}
    </section>
  );
}

function TagEditor({ tags, onChange }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const nextTag = input.trim().replace(/^#/, "");
    if (!nextTag || tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) return;
    onChange([...tags, nextTag]);
    setInput("");
  };

  return (
    <div className="tag-editor">
      <div className="editable-tags">
        {tags.map((tag) => (
          <span className="editable-tag" key={tag}>
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((existing) => existing !== tag))} aria-label={`Remove ${tag}`}>
              <X size={12} weight="regular" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a detail"
          aria-label="Add detail tag"
        />
        <button type="button" onClick={addTag} disabled={!input.trim()} aria-label="Add detail">
          <Plus size={15} weight="regular" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ColorControl({ label, field, value, palette, onChange, sampling, setSampling, optional = false, onClear, onAdd }) {
  if (optional && !value) {
    return (
      <div className="color-slot empty-color-slot">
        <div className="color-slot-heading">
          <span>{label}</span>
          <small>Optional</small>
        </div>
        <p>No distinct secondary color detected.</p>
        <button className="add-secondary-button" type="button" onClick={onAdd}>Add secondary color</button>
      </div>
    );
  }

  const uniquePalette = palette.filter((color, index) => (
    palette.findIndex((candidate) => candidate.toLowerCase() === color.toLowerCase()) === index
  ));

  return (
    <div className="color-slot">
      <div className="color-slot-heading">
        <span>{label}</span>
        {optional && <button type="button" onClick={onClear}>Remove</button>}
      </div>
      <label className="selected-color-control">
        <input
          type="color"
          value={value || "#9a9286"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Choose ${label.toLowerCase()}`}
        />
        <span className="selected-color-copy">
          <small>Selected</small>
          <strong>{value || "Custom"}</strong>
        </span>
      </label>
      <div className="suggestion-heading">
        <span>Image suggestions</span>
        <small>Click to apply</small>
      </div>
      <div className="palette" aria-label={`${label} suggestions from image`}>
        {uniquePalette.map((color) => (
          <button
            type="button"
            key={color}
            className={value?.toLowerCase() === color.toLowerCase() ? "active" : ""}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Use ${color} as ${label.toLowerCase()}`}
            title={color}
          />
        ))}
      </div>
      <button
        className={`sample-button${sampling === field ? " active" : ""}`}
        type="button"
        onClick={() => setSampling((current) => current === field ? null : field)}
      >
        {sampling === field ? "Cancel picking" : `Pick ${label.toLowerCase()} from image`}
      </button>
    </div>
  );
}

function ItemEditor({ draft, setDraft, palette, sampling, setSampling, sampleStatus }) {
  const suggestedSecondary = palette.find((color) => color.toLowerCase() !== draft.color?.toLowerCase()) || "#9a9286";

  return (
    <div className="item-editor">
      <label className="field">
        <span>Name</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder={TYPE_MAP[draft.part]?.singular || "Wardrobe item"}
        />
      </label>

      <label className="field">
        <span>Category</span>
        <select value={draft.part} onChange={(event) => setDraft((current) => ({ ...current, part: event.target.value }))}>
          {TYPES.slice(1).map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}
        </select>
      </label>

      <fieldset className="color-field">
        <legend>Colors</legend>
        <div className="colors-editor">
          <ColorControl
            label="Primary color"
            field="primary"
            value={draft.color}
            palette={palette}
            onChange={(color) => setDraft((current) => ({ ...current, color }))}
            sampling={sampling}
            setSampling={setSampling}
          />
          <ColorControl
            label="Secondary color"
            field="secondary"
            value={draft.secondaryColor}
            palette={palette}
            onChange={(secondaryColor) => setDraft((current) => ({ ...current, secondaryColor }))}
            sampling={sampling}
            setSampling={setSampling}
            optional
            onClear={() => setDraft((current) => ({ ...current, secondaryColor: null }))}
            onAdd={() => setDraft((current) => ({ ...current, secondaryColor: suggestedSecondary }))}
          />
        </div>
        <p className="color-help" aria-live="polite">{sampling ? `Click anywhere on the garment to sample the ${sampling} color.` : sampleStatus || "Primary colors come from the image. A secondary is suggested only when a distinct color has meaningful coverage."}</p>
      </fieldset>

      <div className="field details-field">
        <span>Details</span>
        <TagEditor tags={draft.tags} onChange={(tags) => setDraft((current) => ({ ...current, tags }))} />
      </div>
    </div>
  );
}

function ItemViewer({ item, items, onClose, onSave, onDelete }) {
  const closeButtonRef = useRef(null);
  const imageRef = useRef(null);
  const samplingCanvasRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const [sampling, setSampling] = useState(null);
  const [sampleStatus, setSampleStatus] = useState("");
  const [palette, setPalette] = useState(item.palette || []);
  const [draft, setDraft] = useState({ name: item.name || "", part: item.part, color: item.color || "#9a9286", secondaryColor: item.secondaryColor || null, tags: [...(item.tags || [])] });
  const [shaking, setShaking] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const type = TYPE_MAP[item.part]?.singular || "Wardrobe item";
  const hasModeledImage = Boolean(item.modeledImage);
  const pieceRotation = useMemo(() => {
    const hash = [...item.id].reduce((total, character) => total + character.charCodeAt(0), 0);
    return `${(hash % 9) - 4}deg`;
  }, [item.id]);

  const isDirty = useMemo(() => {
    const normalizedTags = (tags) => tags.map((tag) => tag.trim()).filter(Boolean);
    return JSON.stringify({
      name: draft.name.trim(),
      part: draft.part,
      color: draft.color?.toLowerCase() || null,
      secondaryColor: draft.secondaryColor?.toLowerCase() || null,
      tags: normalizedTags(draft.tags),
    }) !== JSON.stringify({
      name: (item.name || "").trim(),
      part: item.part,
      color: item.color?.toLowerCase() || null,
      secondaryColor: item.secondaryColor?.toLowerCase() || null,
      tags: normalizedTags(item.tags || []),
    });
  }, [draft, item]);

  const nudgeUnsaved = useCallback(() => {
    setCloseBlocked(true);
    setShaking(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShaking(true));
    });
    clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShaking(false), 420);
  }, []);

  const requestClose = useCallback(() => {
    if (isDirty) nudgeUnsaved();
    else onClose();
  }, [isDirty, nudgeUnsaved, onClose]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (sampling) setSampling(null);
        else requestClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("viewer-open");
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("viewer-open");
      clearTimeout(shakeTimerRef.current);
    };
  }, [requestClose, sampling]);

  useEffect(() => {
    if (!isDirty) setCloseBlocked(false);
  }, [isDirty]);

  useEffect(() => {
    setSampling(null);
    setSampleStatus("");
    setPalette(item.palette || []);
    setDraft({ name: item.name || "", part: item.part, color: item.color || "#9a9286", secondaryColor: item.secondaryColor || null, tags: [...(item.tags || [])] });
  }, [item]);

  const cancelEditing = () => {
    setDraft({ name: item.name || "", part: item.part, color: item.color || "#9a9286", secondaryColor: item.secondaryColor || null, tags: [...(item.tags || [])] });
    setSampling(null);
    setSampleStatus("");
    onClose();
  };

  const saveEditing = () => {
    onSave({ ...item, ...draft, name: draft.name.trim(), tags: draft.tags.map((tag) => tag.trim()).filter(Boolean) });
    setSampling(null);
    setSampleStatus("Changes saved.");
  };

  const handleImageLoad = (event) => {
    samplingCanvasRef.current = buildSamplingCanvas(event.currentTarget);
    const extracted = extractPalette(event.currentTarget);
    setPalette([...new Set([...(item.palette || []), ...extracted])].slice(0, 5));
  };

  const handleImageClick = (event) => {
    if (!sampling || !samplingCanvasRef.current) return;
    const color = sampleImageColor(event.currentTarget, samplingCanvasRef.current, event);
    if (!color) {
      setSampleStatus("That spot is transparent—try directly on the garment.");
      return;
    }
    const targetField = sampling === "secondary" ? "secondaryColor" : "color";
    setDraft((current) => ({ ...current, [targetField]: color }));
    setPalette((current) => [color, ...current.filter((existing) => existing.toLowerCase() !== color.toLowerCase())].slice(0, 5));
    setSampleStatus(`Sampled ${color} as the ${sampling} color.`);
    setSampling(null);
  };

  const garmentArtwork = (
    <div
      className={`viewer-art${hasModeledImage ? " viewer-art-floating" : ""}${sampling ? " sampling" : ""}`}
      style={hasModeledImage ? { "--piece-rotation": pieceRotation } : undefined}
    >
      <OptimizedImage
        ref={imageRef}
        src={item.image}
        alt={`Selected ${type.toLowerCase()}`}
        sizes="(max-width: 520px) 40vw, 300px"
        breakpoints={[160, 240, 320, 480, 640]}
        priority
        onLoad={handleImageLoad}
        onClick={handleImageClick}
      />
      {sampling && <span className="sample-hint">Click garment to sample</span>}
    </div>
  );

  return (
    <div className="viewer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
    <div className="viewer-entry">
    <aside className={`viewer editing${hasModeledImage ? " has-modeled-image" : ""}${shaking ? " shake" : ""}`} role="dialog" aria-modal="true" aria-label="Selected wardrobe item">
      <button className="viewer-icon-close" type="button" onClick={requestClose} aria-label="Close viewer" ref={closeButtonRef}>
        <X size={24} weight="light" aria-hidden="true" />
      </button>

      {hasModeledImage ? (
        <div className="modeled-hero">
          <OptimizedImage
            className="modeled-hero-photo"
            src={item.modeledImage}
            alt={`${draft.name || type} worn by a model`}
            sizes="(max-width: 860px) 100vw, 520px"
            breakpoints={[320, 480, 640, 800, 1040, 1280]}
            quality={82}
            priority
          />
          <div className="viewer-heading modeled-heading">
            <div>
              <h2>{draft.name || TYPE_MAP[draft.part]?.singular}</h2>
            </div>
          </div>
          {garmentArtwork}
        </div>
      ) : (
        <>
          <div className="viewer-heading">
            <div>
              <h2>{draft.name || TYPE_MAP[draft.part]?.singular}</h2>
            </div>
          </div>
          {garmentArtwork}
        </>
      )}

      <div className="viewer-details editing">
        <LookBuilderPanel item={{ ...item, ...draft }} items={items} />

        <ItemEditor
          draft={draft}
          setDraft={setDraft}
          palette={palette}
          sampling={sampling}
          setSampling={setSampling}
          sampleStatus={sampleStatus}
        />

        {closeBlocked && <p className="unsaved-notice" role="status">Save or cancel changes before closing.</p>}

        <div className="viewer-actions">
          <button className="delete-button" type="button" onClick={() => onDelete(item.id)}>
            <Trash size={15} weight="regular" aria-hidden="true" /> Delete
          </button>
          <span className="action-spacer" />
          <button className="secondary-button" type="button" onClick={cancelEditing}>Cancel</button>
          <button className="primary-button" type="button" onClick={saveEditing}>
            <Check size={15} weight="bold" aria-hidden="true" /> Save item
          </button>
        </div>
      </div>
    </aside>
    </div>
    </div>
  );
}

export function App() {
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [activeView, setActiveView] = useState("wardrobe");
  const [activeType, setActiveType] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outfitLoading, setOutfitLoading] = useState(true);
  const [error, setError] = useState("");
  const [outfitError, setOutfitError] = useState("");

  useEffect(() => {
    fetch("/api/import/wardrobe", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the wardrobe.");
        return response.json();
      })
      .then((loadedItems) => {
        const edits = readEdits();
        const deleted = readDeletedItems();
        const visibleItems = loadedItems.filter((item) => !deleted.has(item.id));
        setItems(visibleItems.map((item) => ({ ...item, ...(edits[item.id] || {}) })));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/import/outfits", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load outfit ideas.");
        return response.json();
      })
      .then((payload) => setOutfits(Array.isArray(payload) ? payload : payload.outfits || []))
      .catch((requestError) => setOutfitError(requestError.message))
      .finally(() => setOutfitLoading(false));
  }, []);

  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const selectedOutfit = outfits.find((outfit) => outfit.id === selectedOutfitId) || null;

  const visibleItems = useMemo(() => {
    const filtered = activeType === "all" ? items : items.filter((item) => item.part === activeType);
    return [...filtered].sort((a, b) => {
      if (activeType === "all") {
        const typeDifference = (TYPE_ORDER[a.part] ?? 99) - (TYPE_ORDER[b.part] ?? 99);
        if (typeDifference) return typeDifference;
      }
      return a.id.localeCompare(b.id);
    });
  }, [activeType, items]);

  const chooseType = (typeId) => {
    setActiveType(typeId);
    setSelectedId(null);
  };

  const chooseView = (view) => {
    setActiveView(view);
    setSelectedId(null);
    setSelectedOutfitId(null);
  };

  const saveItem = (updatedItem) => {
    setItems((current) => current.map((item) => item.id === updatedItem.id ? updatedItem : item));
    persistEdit(updatedItem);
  };

  const deleteItem = async (id) => {
    if (id.startsWith("import-")) {
      try {
        const response = await fetch(`/api/import/wardrobe/${id}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error("Could not delete the imported item.");
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    setItems((current) => current.filter((item) => item.id !== id));
    removePersistedEdit(id);
    persistDeletedItem(id);
    setSelectedId(null);
  };

  const addImportedItem = useCallback((newItem) => {
    setItems((current) => current.some((item) => item.id === newItem.id) ? current : [...current, newItem]);
  }, []);

  const attachImportedModeledImage = useCallback((jobId, modeledImage) => {
    const id = `import-${jobId}`;
    setItems((current) => current.map((item) => item.id === id ? { ...item, modeledImage } : item));
  }, []);

  return (
    <div className={`app-shell${selectedItem ? " has-selection" : ""}`}>
      <main className="gallery-pane">
        <header className="gallery-header">
          <div className="gallery-meta-row">
            <p className="piece-count">{activeView === "wardrobe" ? `${items.length} ${items.length === 1 ? "piece" : "pieces"}` : `${outfits.length} ${outfits.length === 1 ? "look" : "looks"}`}</p>
            <nav className="view-nav" aria-label="Choose collection" role="tablist">
              <button
                type="button"
                className={activeView === "wardrobe" ? "active" : ""}
                onClick={() => chooseView("wardrobe")}
                aria-selected={activeView === "wardrobe"}
                role="tab"
              >
                Wardrobe
              </button>
              <button
                type="button"
                className={activeView === "outfits" ? "active" : ""}
                onClick={() => chooseView("outfits")}
                aria-selected={activeView === "outfits"}
                role="tab"
              >
                Outfits
                {outfits.length > 0 && <span className="view-nav-count">{outfits.length}</span>}
              </button>
            </nav>
          </div>
          {activeView === "wardrobe" && (
            <nav className="category-nav" aria-label="Filter wardrobe by item type">
              {TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={activeType === type.id ? "active" : ""}
                  onClick={() => chooseType(type.id)}
                  aria-pressed={activeType === type.id}
                >
                  {type.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        {activeView === "wardrobe" && (
          <>
            {error && <p className="status error">{error}</p>}
            {!error && loading && <p className="status">Loading wardrobe</p>}
            {!error && !loading && !items.length && <p className="status empty">Drop, paste, or add a photo to import your first piece.</p>}
            {!!items.length && (
              <section className="gallery-grid" aria-label={`${TYPE_MAP[activeType]?.label || "All"} wardrobe items`}>
                {visibleItems.map((item) => (
                  <GalleryItem
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onOpen={setSelectedId}
                  />
                ))}
              </section>
            )}
          </>
        )}

        {activeView === "outfits" && (
          <>
            {outfitError && <p className="status error">{outfitError}</p>}
            {!outfitError && outfitLoading && <p className="status">Loading outfit ideas</p>}
            {!outfitError && !outfitLoading && !outfits.length && <p className="status empty">Generate an outfit collection to see modeled looks here.</p>}
            {!!outfits.length && (
              <section className="outfit-grid" aria-label="Modeled outfit ideas">
                {outfits.map((outfit) => (
                  <OutfitCard
                    key={outfit.id}
                    outfit={outfit}
                    selected={selectedOutfitId === outfit.id}
                    onOpen={setSelectedOutfitId}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {selectedItem && <ItemViewer item={selectedItem} items={items} onClose={() => setSelectedId(null)} onSave={saveItem} onDelete={deleteItem} />}
      {selectedOutfit && <OutfitViewer outfit={selectedOutfit} items={items} onClose={() => setSelectedOutfitId(null)} />}
      <WardrobeImportFlow onGarmentApproved={addImportedItem} onModeledApproved={attachImportedModeledImage} />
    </div>
  );
}
