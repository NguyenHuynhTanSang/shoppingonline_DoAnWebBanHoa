import React, {
  useEffect,
  useRef,
  useState
} from 'react';

const PRICE_OPTIONS = [
  {
    value: 'all',
    label: 'Tất cả mức giá'
  },
  {
    value: 'under-1000',
    label: 'Dưới 1.000.000 đ'
  },
  {
    value: '1000-2000',
    label: '1.000.000 đ - 2.000.000 đ'
  },
  {
    value: '2000-3000',
    label: '2.000.000 đ - 3.000.000 đ'
  },
  {
    value: 'over-3000',
    label: 'Trên 3.000.000 đ'
  }
];

function PriceFilter({
  value = 'all',
  onChange
}) {
  const [open, setOpen] =
    useState(false);

  const wrapperRef =
    useRef(null);

  const selected =
    PRICE_OPTIONS.find(
      option =>
        option.value === value
    ) || PRICE_OPTIONS[0];

  useEffect(() => {
    function handleOutsideClick(
      event
    ) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );
    };
  }, []);

  useEffect(() => {
    function handleEscape(event) {
      if (
        event.key === 'Escape'
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, []);

  function selectOption(option) {
    if (
      typeof onChange ===
      'function'
    ) {
      onChange(
        option.value
      );
    }

    setOpen(false);
  }

  return (
    <div
      className={
        `wf-price-filter${
          open
            ? ' is-open'
            : ''
        }`
      }
      ref={wrapperRef}
    >
      <button
        type="button"
        className="wf-price-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            previous =>
              !previous
          )
        }
      >
        <span className="wf-price-filter-icon">
          ≡
        </span>

        <span className="wf-price-filter-trigger-text">
          <span className="wf-price-filter-title">
            Lọc theo giá
          </span>

          <span className="wf-price-filter-current">
            {selected.label}
          </span>
        </span>

        <span
          className="wf-price-filter-arrow"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="wf-price-filter-menu"
          role="listbox"
          aria-label="Chọn mức giá"
        >
          <div className="wf-price-filter-menu-head">
            Chọn khoảng giá
          </div>

          {PRICE_OPTIONS.map(
            option => {
              const active =
                option.value ===
                value;

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={
                    active
                  }
                  key={
                    option.value
                  }
                  className={
                    `wf-price-filter-option${
                      active
                        ? ' is-active'
                        : ''
                    }`
                  }
                  onClick={() =>
                    selectOption(
                      option
                    )
                  }
                >
                  <span className="wf-price-filter-check">
                    {active
                      ? '✓'
                      : ''}
                  </span>

                  <span>
                    {
                      option.label
                    }
                  </span>
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

export default PriceFilter;