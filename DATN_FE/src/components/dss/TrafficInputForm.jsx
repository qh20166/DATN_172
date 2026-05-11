import PlacesSearch from '../PlacesSearch';

function TrafficInputForm({ value, onChange, onSubmit, loading }) {
  function handlePlaceChange(field, place) {
    onChange(field, place);
  }

  function handleTextChange(field, text) {
    onChange(field, text);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Route Input</h3>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-600 md:col-span-2">
          Đường đi
          <div className="mt-1">
            <PlacesSearch
              id="route-origin"
              placeholder="Nhập đường đi / điểm xuất phát"
              value={value.origin?.name || ''}
              onInputChange={(text) => handleTextChange('originText', text)}
              onPlaceSelected={(place) => handlePlaceChange('origin', place)}

            />
          </div>
        </label>

        <label className="text-sm text-slate-600 md:col-span-2">
          Đường đến
          <div className="mt-1">
            <PlacesSearch
              id="route-destination"
              placeholder="Nhập đường đến / điểm kết thúc"
              value={value.destination?.name || ''}
              onInputChange={(text) => handleTextChange('destinationText', text)}
              onPlaceSelected={(place) => handlePlaceChange('destination', place)}

            />
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="md:col-span-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Đang dự báo...' : 'Dự báo'}
        </button>
      </form>
    </section>
  );
}

export default TrafficInputForm;
