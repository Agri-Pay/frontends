<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>NDVI Color Ramp</Name>
    <UserStyle>
      <Title>NDVI Visualization</Title>
      <Abstract>Red to Green color ramp for NDVI values (-1 to 1)</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="ramp">
              <!-- Water / No Data -->
              <ColorMapEntry color="#0000FF" quantity="-1" label="Water" opacity="1"/>
              <!-- Bare Soil / Rock -->
              <ColorMapEntry color="#d73027" quantity="-0.2" label="Bare/Stressed" opacity="1"/>
              <!-- Very Sparse Vegetation -->
              <ColorMapEntry color="#fc8d59" quantity="0" label="Sparse" opacity="1"/>
              <!-- Sparse Vegetation -->
              <ColorMapEntry color="#fee08b" quantity="0.1" label="Very Light" opacity="1"/>
              <!-- Moderate Vegetation -->
              <ColorMapEntry color="#d9ef8b" quantity="0.2" label="Light" opacity="1"/>
              <!-- Healthy Vegetation -->
              <ColorMapEntry color="#91cf60" quantity="0.4" label="Moderate" opacity="1"/>
              <!-- Dense Vegetation -->
              <ColorMapEntry color="#1a9850" quantity="0.6" label="Dense" opacity="1"/>
              <!-- Very Dense Vegetation -->
              <ColorMapEntry color="#006837" quantity="1" label="Very Dense" opacity="1"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
