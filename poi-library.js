(()=>{
  'use strict';

  const VERSION='0.6.10.0';
  try{
    localStorage.removeItem('nmPoi7');
    localStorage.nmPoiLibraryVersion=VERSION;
  }catch{}

  const poiMeta=new Map();
  const key=(lat,lon)=>`${Number(lat).toFixed(5)}|${Number(lon).toFixed(5)}`;
  const spec=(id,emoji,label,priority=6)=>({id,emoji,label,priority});

  function classify(t={}){
    const a=t.amenity||'', shop=t.shop||'', tourism=t.tourism||'', leisure=t.leisure||'';
    const railway=t.railway||'', pt=t.public_transport||'', aeroway=t.aeroway||'';
    const historic=t.historic||'', healthcare=t.healthcare||'', emergency=t.emergency||'';
    const natural=t.natural||'', office=t.office||'', craft=t.craft||'', sport=t.sport||'';

    if(a==='hospital') return spec('hospital','🏥','Hôpital',10);
    if(a==='clinic') return spec('clinic','🏥','Clinique',10);
    if(a==='doctors'||healthcare==='doctor') return spec('doctor','🩺','Médecin',9);
    if(a==='dentist'||healthcare==='dentist') return spec('dentist','🦷','Dentiste',9);
    if(a==='pharmacy') return spec('pharmacy','💊','Pharmacie',10);
    if(a==='veterinary'||healthcare==='veterinary') return spec('vet','🐾','Vétérinaire',8);
    if(a==='fuel') return spec('fuel','⛽','Station-service',9);
    if(a==='charging_station') return spec('charging','🔌','Borne de recharge',8);
    if(a==='bank') return spec('bank','🏦','Banque',8);
    if(a==='atm') return spec('atm','🏧','Distributeur',8);
    if(a==='parking'||a==='parking_entrance') return spec('parking','🅿️','Parking',7);
    if(a==='school'||a==='kindergarten') return spec('school','🏫','École',7);
    if(a==='college'||a==='university') return spec('university','🎓','Université',8);
    if(a==='police') return spec('police','👮','Police',10);
    if(a==='fire_station') return spec('fire','🚒','Pompiers',10);
    if(a==='post_office'||a==='post_box') return spec('post','📮','Poste',7);
    if(a==='toilets') return spec('toilets','🚻','Toilettes',6);
    if(a==='library') return spec('library','📚','Bibliothèque',7);
    if(a==='theatre') return spec('theatre','🎭','Théâtre',8);
    if(a==='cinema') return spec('cinema','🎬','Cinéma',9);
    if(a==='marketplace') return spec('market','🧺','Marché',8);
    if(a==='community_centre'||a==='townhall') return spec('civic','🏛️','Lieu public',7);
    if(a==='place_of_worship'){
      if(t.religion==='muslim') return spec('mosque','🕌','Mosquée',8);
      if(t.religion==='christian') return spec('church','⛪','Église',8);
      if(t.religion==='jewish') return spec('synagogue','🕍','Synagogue',8);
      if(t.religion==='buddhist'||t.religion==='hindu') return spec('temple','🛕','Temple',8);
      return spec('worship','🙏','Lieu de culte',8);
    }
    if(a==='taxi') return spec('taxi','🚕','Taxi',8);
    if(a==='bus_station') return spec('bus','🚌','Gare routière',8);
    if(a==='ferry_terminal') return spec('ferry','⛴️','Ferry',8);
    if(a==='car_rental'||a==='car_sharing') return spec('car-rental','🚗','Location voiture',7);
    if(a==='bicycle_rental'||a==='bicycle_parking') return spec('bike','🚲','Vélo',7);
    if(a==='fast_food'||a==='food_court') return spec('fastfood','🍔','Restauration rapide',8);
    if(a==='restaurant') return spec('restaurant','🍽️','Restaurant',10);
    if(a==='cafe') return spec('cafe','☕','Café',9);
    if(a==='bar'||a==='pub'||a==='biergarten') return spec('bar','🍺','Bar',9);

    if(tourism==='hotel'||tourism==='motel'||tourism==='hostel'||tourism==='guest_house'||tourism==='apartment') return spec('hotel','🏨','Hôtel',9);
    if(tourism==='museum') return spec('museum','🏛️','Musée',9);
    if(tourism==='gallery') return spec('gallery','🖼️','Galerie',7);
    if(tourism==='zoo') return spec('zoo','🦁','Zoo',9);
    if(tourism==='theme_park') return spec('themepark','🎢','Parc d’attractions',9);
    if(tourism==='attraction') return spec('attraction','🎡','Attraction',8);
    if(tourism==='viewpoint') return spec('viewpoint','🔭','Point de vue',7);
    if(tourism==='camp_site'||tourism==='caravan_site') return spec('camp','⛺','Camping',7);
    if(tourism==='information') return spec('info','ℹ️','Information',6);

    if(leisure==='park'||leisure==='garden'||leisure==='nature_reserve') return spec('park','🌳','Parc',8);
    if(leisure==='stadium') return spec('stadium','🏟️','Stade',9);
    if(leisure==='sports_centre'||leisure==='fitness_centre') return spec('sport','🏋️','Sport',8);
    if(leisure==='swimming_pool'||leisure==='water_park') return spec('swim','🏊','Piscine',8);
    if(leisure==='playground') return spec('playground','🛝','Aire de jeux',7);
    if(leisure==='golf_course') return spec('golf','⛳','Golf',7);
    if(leisure==='marina') return spec('marina','⚓','Marina',7);

    if(natural==='beach') return spec('beach','🏖️','Plage',9);

    if(shop==='supermarket'||shop==='grocery') return spec('supermarket','🛒','Supermarché',9);
    if(shop==='mall'||shop==='department_store') return spec('mall','🏬','Centre commercial',9);
    if(shop==='bakery'||shop==='pastry') return spec('bakery','🥖','Boulangerie',8);
    if(shop==='convenience') return spec('convenience','🏪','Supérette',8);
    if(shop==='hairdresser'||shop==='beauty') return spec('hairdresser','💇','Coiffeur / beauté',7);
    if(shop==='clothes'||shop==='shoes'||shop==='fashion') return spec('fashion','👕','Mode',7);
    if(shop==='electronics'||shop==='mobile_phone'||shop==='computer') return spec('electronics','📱','Électronique',7);
    if(shop==='books') return spec('books','📚','Librairie',7);
    if(shop==='car'||shop==='car_repair'||shop==='tyres') return spec('car','🚘','Automobile',7);
    if(shop) return spec('shop','🛍️','Magasin',7);

    if(railway==='station'||railway==='halt') return spec('train','🚉','Gare',9);
    if(railway==='subway_entrance') return spec('metro','🚇','Métro',9);
    if(railway==='tram_stop') return spec('tram','🚋','Tram',8);
    if(pt==='platform'||pt==='stop_position') return spec('bus','🚌','Transport',8);

    if(aeroway==='aerodrome'||aeroway==='terminal'||aeroway==='gate') return spec('airport','✈️','Aéroport',10);

    if(historic==='castle') return spec('castle','🏰','Château',9);
    if(historic==='monument'||historic==='memorial'||historic==='archaeological_site'||historic) return spec('historic','🏛️','Monument',8);

    if(emergency==='ambulance_station') return spec('ambulance','🚑','Ambulance',10);
    if(emergency==='defibrillator') return spec('defib','❤️','Défibrillateur',9);
    if(emergency) return spec('emergency','🚨','Urgence',10);

    if(sport) return spec('sport','🏅','Sport',7);
    if(office) return spec('office','🏢','Bureau / entreprise',6);
    if(craft) return spec('craft','🛠️','Artisan',6);
    return spec('place','📍','Lieu',4);
  }

  function remember(data){
    for(const el of data?.elements||[]){
      const lat=Number(el.lat??el.center?.lat), lon=Number(el.lon??el.center?.lon);
      if(Number.isFinite(lat)&&Number.isFinite(lon)) poiMeta.set(key(lat,lon),el.tags||{});
    }
  }

  const realFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await realFetch(input,init);
    try{
      const url=typeof input==='string'?input:input?.url||'';
      if(url.includes('/api/pois')) remember(await response.clone().json());
    }catch{}
    return response;
  };

  if(window.L?.marker){
    const realMarker=window.L.marker;
    const enhanced=function(latlng,options){
      try{
        if(options?.pane==='nova'&&options?.icon?.options){
          const lat=Array.isArray(latlng)?latlng[0]:latlng?.lat;
          const lon=Array.isArray(latlng)?latlng[1]:latlng?.lng;
          const tags=poiMeta.get(key(lat,lon));
          if(tags){
            const c=classify(tags), io=options.icon.options;
            io.className=`poi ${c.id}`;
            io.html=String(io.html||'').replace(/(<div class="p"[^>]*>).*?(<\/div>)/,`$1${c.emoji}$2`);
            io.novaCategory=c;
          }
        }
      }catch{}
      return realMarker.call(window.L,latlng,options);
    };
    Object.assign(enhanced,realMarker);
    window.L.marker=enhanced;
  }

  window.NOVAPoiLibrary={version:VERSION,classify};
})();
