FROM ubuntu:latest

RUN useradd -ms /bin/bash dave

RUN apt-get -y update
RUN apt-get install -y python3 python3-pip

ADD bin /bin/hackos
RUN chmod -R +x /bin/hackos
RUN pip3 install tabulate

ENV HOME /home/dave
USER dave

WORKDIR /home/dave
ADD home /home/dave

RUN echo 'export PATH="/bin/hackos:$PATH"' >> /home/dave/.bashrc
RUN echo 'alias help=/bin/hackos/help' >> ~/.bashrc

CMD [ '/bin/bash' ]
