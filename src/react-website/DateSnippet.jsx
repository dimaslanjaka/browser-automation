import React from 'react';
import { Card, Container } from 'react-bootstrap';
import styles from './Date.module.scss';
import Footer from './components/Footer';
import Header from './components/Header';
import AdSense from './components/Adsense';

class Snippet extends React.Component {
  componentDidMount() {
    // require('./snippet-styles.scss');
  }

  render() {
    return (
      <section>
        <div className="mx-auto p-2">
          <h2>
            <a href="#formatting-1" className="text-decoration-none">
              #
            </a>{' '}
            Formatting
          </h2>
          <p>moment format cheatsheet</p>
          <div>
            <div>
              <h3>Examples</h3>
              <div>
                <h4>Date</h4>
                <table className={`table table-striped ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Example</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>YYYY-MM-DD</code>
                      </td>
                      <td>2014-01-01</td>
                    </tr>
                    <tr>
                      <td>
                        <code>dddd, MMMM Do YYYY</code>
                      </td>
                      <td>Friday, May 16th 2014</td>
                    </tr>
                    <tr>
                      <td>
                        <code>dddd [the] Do [of] MMMM</code>
                      </td>
                      <td>Friday the 16th of May</td>
                    </tr>
                  </tbody>
                </table>
                <h4>Time</h4>
                <table className={`table table-striped ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Example</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>hh:mm a</code>
                      </td>
                      <td>12:30 pm</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Used by{' '}
                  <a rel="nofollow noopener" href="http://momentjs.com/docs/#/displaying/">
                    Moment.js
                  </a>{' '}
                  and{' '}
                  <a rel="nofollow noopener" href="https://date-fns.org/v1.28.5/docs/format">
                    date-fns/format
                  </a>
                  . Similar to Java{' '}
                  <a
                    rel="nofollow noopener"
                    href="https://docs.oracle.com/javase/7/docs/api/java/text/SimpleDateFormat.html">
                    SimpleDateFormat
                  </a>
                  .
                </p>
              </div>
            </div>
            <AdSense
              client="ca-pub-2188063137129806"
              slot="5634823028"
              style={{ display: 'block', textAlign: 'center' }}
              layout="in-article"
              format="fluid"
            />
            <div>
              <h3>Date</h3>
              <div>
                <table className={`table table-striped ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Example</th>
                      <th>Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>d</code>
                      </td>
                      <td>
                        <code>0</code>..<code>6</code>
                      </td>
                      <td rowSpan={4}>
                        <b>Weekday</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>dd</code>
                      </td>
                      <td>
                        <code>Su</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>ddd</code>
                      </td>
                      <td>
                        <code>Sun</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>dddd</code>
                      </td>
                      <td>
                        <code>Sunday</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>YY</code>
                      </td>
                      <td>
                        <code>13</code>
                      </td>
                      <td rowSpan={2}>
                        <b>Year</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>YYYY</code>
                      </td>
                      <td>
                        <code>2013</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>M</code>
                      </td>
                      <td>
                        <code>1</code>..<code>12</code> <em>(Jan is 1)</em>
                      </td>
                      <td rowSpan={5}>
                        <b>Month</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>Mo</code>
                      </td>
                      <td>
                        <code>1st</code>..<code>12th</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>MM</code>
                      </td>
                      <td>
                        <code>01</code>..<code>12</code> <em>(Jan is 1)</em>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>MMM</code>
                      </td>
                      <td>
                        <code>Jan</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>MMMM</code>
                      </td>
                      <td>
                        <code>January</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>Q</code>
                      </td>
                      <td>
                        <code>1</code>..<code>4</code>
                      </td>
                      <td rowSpan={2}>
                        <b>Quarter</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>Qo</code>
                      </td>
                      <td>
                        <code>1st</code>..<code>4th</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>D</code>
                      </td>
                      <td>
                        <code>1</code>..<code>31</code>
                      </td>
                      <td rowSpan={3}>
                        <b>Day</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>Do</code>
                      </td>
                      <td>
                        <code>1st</code>..<code>31st</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>DD</code>
                      </td>
                      <td>
                        <code>01</code>..<code>31</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>DDD</code>
                      </td>
                      <td>
                        <code>1</code>..<code>365</code>
                      </td>
                      <td rowSpan={3}>
                        <b>Day of year</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>DDDo</code>
                      </td>
                      <td>
                        <code>1st</code>..<code>365th</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>DDDD</code>
                      </td>
                      <td>
                        <code>001</code>..<code>365</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>w</code>
                      </td>
                      <td>
                        <code>1</code>..<code>53</code>
                      </td>
                      <td rowSpan={3}>
                        <b>Week of year</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>wo</code>
                      </td>
                      <td>
                        <code>1st</code>..<code>53rd</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>ww</code>
                      </td>
                      <td>
                        <code>01</code>..<code>53</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Time</h3>
              <div>
                <table className={`table table-striped ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Example</th>
                      <th>Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>H</code>
                      </td>
                      <td>
                        <code>0</code>..<code>23</code>
                      </td>
                      <td rowSpan={2}>
                        <b>24h hour</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>HH</code>
                      </td>
                      <td>
                        <code>00</code>..<code>23</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>h</code>
                      </td>
                      <td>
                        <code>1</code>..<code>12</code>
                      </td>
                      <td rowSpan={2}>
                        <b>12h hour</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>hh</code>
                      </td>
                      <td>
                        <code>01</code>..<code>12</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>m</code>
                      </td>
                      <td>
                        <code>0</code>..<code>59</code>
                      </td>
                      <td rowSpan={2}>
                        <b>Minutes</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>mm</code>
                      </td>
                      <td>
                        <code>00</code>..<code>59</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>s</code>
                      </td>
                      <td>
                        <code>0</code>..<code>59</code>
                      </td>
                      <td rowSpan={2}>
                        <b>Seconds</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>ss</code>
                      </td>
                      <td>
                        <code>00</code>..<code>59</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>a</code>
                      </td>
                      <td>
                        <code>am</code>
                      </td>
                      <td rowSpan={2}>
                        <b>AM/PM</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>A</code>
                      </td>
                      <td>
                        <code>AM</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>Z</code>
                      </td>
                      <td>
                        <code>+07:00</code>
                      </td>
                      <td rowSpan={2}>
                        <b>Timezone offset</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>ZZ</code>
                      </td>
                      <td>
                        <code>+0730</code>
                      </td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>S</code>
                      </td>
                      <td>
                        <code>0</code>..<code>9</code>
                      </td>
                      <td>Deciseconds</td>
                    </tr>
                    <tr>
                      <td>
                        <code>SS</code>
                      </td>
                      <td>
                        <code>00</code>..<code>99</code>
                      </td>
                      <td>Centiseconds</td>
                    </tr>
                    <tr>
                      <td>
                        <code>SSS</code>
                      </td>
                      <td>
                        <code>000</code>..<code>999</code>
                      </td>
                      <td>Milliseconds</td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>X</code>
                      </td>
                      <td>
                        <code>1626612345</code>
                      </td>
                      <td>Unix timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>x</code>
                      </td>
                      <td>
                        <code>1626612345678</code>
                      </td>
                      <td>Millisecond Unix timestamp</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Presets</h3>
              <div>
                <table className={`table table-striped ${styles.table}`}>
                  <thead>
                    <tr>
                      <th>Example</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>LT</code>
                      </td>
                      <td>8:30 PM</td>
                    </tr>
                    <tr>
                      <td>
                        <code>LTS</code>
                      </td>
                      <td>8:30:25 PM</td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>LL</code>
                      </td>
                      <td>August 2 1985</td>
                    </tr>
                    <tr>
                      <td>
                        <code>ll</code>
                      </td>
                      <td>Aug 2 1985</td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>LLL</code>
                      </td>
                      <td>August 2 1985 08:30 PM</td>
                    </tr>
                    <tr>
                      <td>
                        <code>lll</code>
                      </td>
                      <td>Aug 2 1985 08:30 PM</td>
                    </tr>
                  </tbody>
                  <tbody>
                    <tr>
                      <td>
                        <code>LLLL</code>
                      </td>
                      <td>Thursday, August 2 1985 08:30 PM</td>
                    </tr>
                    <tr>
                      <td>
                        <code>llll</code>
                      </td>
                      <td>Thu, Aug 2 1985 08:30 PM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
}

class DateSnippet extends React.Component {
  render() {
    return (
      <>
        <Header />
        <Container className="mt-3">
          <Card>
            <Card.Header as="h1" className="text-center">
              Moment.js Date Formatting Snippet
            </Card.Header>
            <Card.Body>
              <Snippet {...this.props} />
            </Card.Body>
          </Card>
        </Container>
        <Footer />
      </>
    );
  }
}

export default DateSnippet;
